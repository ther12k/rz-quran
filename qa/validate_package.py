#!/usr/bin/env python3
"""Validate documentation artifacts, not an implemented application.

Python 3.10+; dependencies: PyYAML, jsonschema, Pillow, PyMuPDF.
Run from any directory: python qa/validate_package.py
Use --output PATH to save the actual report. No network access is used.
This is intentionally NOT a complete OpenAPI semantic validator or SQL executor.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path
from html.parser import HTMLParser
from typing import Any, Callable

try:
    import yaml
    import fitz
    from PIL import Image
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError as exc:
    raise SystemExit('Missing dependency. Install PyYAML jsonschema Pillow PyMuPDF in a virtual environment.') from exc

ROOT=Path(__file__).resolve().parents[1]
RESULTS:list[dict[str,Any]]=[]
COUNTS:dict[str,int]={}


def load(relative:str)->Any:
    return json.loads((ROOT/relative).read_text(encoding='utf-8'))


def require(condition:bool,message:str)->None:
    if not condition: raise AssertionError(message)


def run(name:str,fn:Callable[[],str])->None:
    try:
        detail=fn();RESULTS.append({'check':name,'status':'pass','detail':detail})
    except Exception as exc:
        RESULTS.append({'check':name,'status':'fail','detail':str(exc)})


def walk(value:Any):
    yield value
    if isinstance(value,dict):
        for child in value.values():yield from walk(child)
    elif isinstance(value,list):
        for child in value:yield from walk(child)


def pointer(document:dict,ref:str)->Any:
    require(ref.startswith('#/'),'External reference is not self-contained: '+ref)
    target:Any=document
    for part in ref[2:].split('/'):
        target=target[part.replace('~1','/').replace('~0','~')]
    return target


def json_files()->str:
    paths=[p for p in ROOT.rglob('*.json') if p.relative_to(ROOT).as_posix() not in {'qa/package-validation.json','MANIFEST.json'}]
    for path in paths:json.loads(path.read_text(encoding='utf-8'))
    COUNTS['json_files_parsed']=len(paths)
    return f'{len(paths)} input JSON files parsed (generated report and root manifest excluded).'


def schemas_and_examples()->str:
    fc=FormatChecker();schemas={}
    for name in ['lesson','progress-event','content-manifest']:
        schema=load(f'contracts/{name}.schema.json')
        Draft202012Validator.check_schema(schema)
        schemas[name]=Draft202012Validator(schema,format_checker=fc)
    schemas['lesson'].validate(load('contracts/examples/demo-hijaiyah-lesson.json'))
    schemas['content-manifest'].validate(load('contracts/examples/source-manifest-demo.json'))
    batch=load('contracts/examples/progress-batch.json')
    for event in batch['events']:schemas['progress-event'].validate(event)
    for name in ['heartbeat-too-large','client-child-injection']:
        bad=load(f'contracts/examples/invalid/{name}.json')
        require(not schemas['progress-event'].is_valid(bad),'Negative fixture unexpectedly accepted: '+name)
    COUNTS.update(json_schemas=3,positive_example_files=3,negative_example_files=2)
    return '3 schema meta-checks; 3 positive example files accepted; 2 invalid event fixtures rejected, with format checking enabled.'


def openapi_checks()->str:
    api=yaml.safe_load((ROOT/'contracts/openapi.yaml').read_text(encoding='utf-8'))
    require(api['openapi']=='3.1.0','Unexpected OpenAPI version')
    refs=[n['$ref'] for n in walk(api) if isinstance(n,dict) and '$ref' in n]
    for ref in refs:pointer(api,ref)
    ids=set();ops=0
    for path,item in api['paths'].items():
        for method,op in item.items():
            if method not in {'get','put','post','delete','patch','head','options','trace'}:continue
            ops+=1;oid=op['operationId']
            require(oid not in ids,'Duplicate operationId: '+oid);ids.add(oid)
            require(bool(op.get('x-capability')),'Missing capability: '+oid)
            require(bool(op.get('responses')),'Missing response: '+oid)
            params=item.get('parameters',[])+op.get('parameters',[])
            params=[pointer(api,p['$ref']) if '$ref' in p else p for p in params]
            declared={p['name'] for p in params if p['in']=='path'}
            require(set(re.findall(r'\{([^}]+)\}',path))==declared,'Path parameter mismatch: '+path)
            require(all(p.get('required') for p in params if p['in']=='path'),'Optional path parameter: '+path)
            if op['x-capability']!='public':
                require(bool(op.get('security',api.get('security'))),'Missing auth security: '+oid)
    for name,schema in api['components']['schemas'].items():Draft202012Validator.check_schema(schema)
    # Validate the embedded schema against the same fixture, resolving internal refs only.
    for name,relative in [('AuthoringLesson','contracts/examples/demo-hijaiyah-lesson.json'),('SourceManifest','contracts/examples/source-manifest-demo.json'),('EventBatch','contracts/examples/progress-batch.json')]:
        schema={'$ref':'#/components/schemas/'+name,'components':api['components']}
        Draft202012Validator(schema,format_checker=FormatChecker()).validate(load(relative))
    # Public lesson/question field closure must not expose authoring answers or review evidence.
    forbidden={'correct_option_id','reviewer_reference','evidence_object_key','release_hash'}
    seen=set()
    def inspect(schema):
        if not isinstance(schema,dict):return
        if '$ref' in schema:
            ref=schema['$ref']
            if ref not in seen:seen.add(ref);inspect(pointer(api,ref))
        props=schema.get('properties',{})
        require(not (set(props)&forbidden),'Sensitive field reachable from public content DTO')
        for x in schema.values():
            if isinstance(x,dict):inspect(x)
            elif isinstance(x,list):
                for y in x:inspect(y)
    for name in ['PublicLesson','PublicQuestion']:inspect(api['components']['schemas'][name])
    COUNTS.update(api_operations=ops,api_component_schemas=len(api['components']['schemas']),resolved_api_refs=len(refs))
    return f'{ops} unique operations; {len(api["components"]["schemas"])} schema meta-checks; {len(refs)} refs resolve; paths/auth metadata checked; 3 embedded examples pass. Limited structural checks, not full OpenAPI semantic conformance.'


def planning_checks()->str:
    tasks=load('tasks/backlog.json')['tasks'];cases=load('qa/planned-application-tests.json')['cases']
    ids={x['id'] for x in tasks};qids={x['id'] for x in cases}
    require(len(ids)==len(tasks)==74,'Task count/identity mismatch')
    require(len(qids)==len(cases)==42,'Planned test count/identity mismatch')
    expected={f'FR-{i:02d}' for i in range(1,19)}
    tr=set();qr=set();graph={t['id']:t['dependencies'] for t in tasks}
    for t in tasks:
        require(set(t['dependencies'])<=ids,'Missing task dependency: '+t['id'])
        require(t['id'] not in t['dependencies'],'Self dependency')
        require(t['status']=='todo' and not t['evidence'],'Planned task falsely has completion evidence')
        require(len(t['acceptance_criteria'])>=2,'Incomplete task acceptance criteria')
        require(set(t['requirements'])<=expected,'Unknown requirement');tr.update(t['requirements'])
    visited=set();active=set()
    def visit(node):
        require(node not in active,'Dependency cycle at '+node)
        if node in visited:return
        active.add(node)
        for dep in graph[node]:visit(dep)
        active.remove(node);visited.add(node)
    for node in graph:visit(node)
    for q in cases:
        require(q['status']=='not_run','Unexecuted application test marked otherwise')
        require(set(q['requirements'])<=expected,'Unknown test requirement');qr.update(q['requirements'])
    require(tr==qr==expected,'Missing requirement coverage')
    trace=(ROOT/'tasks/TRACEABILITY.md').read_text()
    require(all(x in trace for x in expected),'Traceability Markdown is missing requirements')
    COUNTS.update(planned_tasks=len(tasks),planned_app_tests=len(cases),requirements=len(expected))
    return '74 planned tasks with valid acyclic dependencies and acceptance criteria; 42 explicitly unrun app tests; all 18 requirements covered in both.'


class Links(HTMLParser):
    def __init__(self):super().__init__();self.targets=[]
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in ('src','href') and value:self.targets.append(value)


def design_checks()->str:
    manifest=load('design/asset-manifest.json');require(len(manifest)==6,'Missing original mockup')
    screens=load('design/screen-inventory.json');sids={x['id'] for x in screens}
    for a in manifest:
        p=ROOT/'design'/a['file'];require(p.is_file(),'Missing image '+a['file'])
        require(hashlib.sha256(p.read_bytes()).hexdigest()==a['sha256'],'Image byte hash mismatch')
        with Image.open(p) as im:require(im.size==(a['width'],a['height'])==(941,1672),'Image size mismatch')
        require(set(a['screen_ids'])<=sids,'Unknown screen mapping')
    for s in screens:
        if s['concept_image']:require((ROOT/'design'/s['concept_image']).is_file(),'Missing concept image')
    html=(ROOT/'design/gallery.html').read_text();parser=Links();parser.feed(html)
    for target in parser.targets:
        require(not re.match(r'^(https?:)?//',target),'Network asset/link in offline gallery')
        require((ROOT/'design'/target).is_file(),'Broken gallery link '+target)
    require('<script' not in html.lower(),'Gallery is expected to be static')
    COUNTS.update(original_mockups=6,specified_screens=len(screens))
    return f'6 original images match registered SHA-256 and dimensions; {len(screens)} screen definitions; all gallery asset links resolve locally.'


def sql_static_checks()->str:
    sql=(ROOT/'database/domain-reference.sql').read_text()
    tables=re.findall(r'CREATE TABLE\s+(\w+)',sql,re.I)
    refs=re.findall(r'REFERENCES\s+(\w+)',sql,re.I)
    require(len(tables)==len(set(tables)),'Duplicate SQL table definition')
    require(set(refs)<=set(tables),'Undeclared reference table')
    for marker in ['BEGIN;','COMMIT;','UNIQUE','FOREIGN KEY','CREATE TRIGGER']:
        require(marker in sql,'Missing expected DDL construct: '+marker)
    require('Not a turnkey production' in sql,'Reference DDL limitation is missing')
    COUNTS['reference_sql_tables']=len(tables)
    return f'{len(tables)} unique table declarations; all referenced table names declared; expected transaction/constraint markers present. Static inspection only: SQL not parsed or executed on PostgreSQL.'


def reading_copy_checks()->str:
    docx=ROOT/'reference/PRD.docx';pdf=ROOT/'reference/PRD.pdf'
    require(docx.is_file() and pdf.is_file(),'Missing reading copy')
    with zipfile.ZipFile(docx) as z:
        require(z.testzip() is None,'DOCX archive integrity failure')
        require('word/document.xml' in z.namelist(),'Missing DOCX main part')
        require(not any(n.startswith('word/fonts/') for n in z.namelist()),'Font files must not be embedded in DOCX')
    with fitz.open(pdf) as p:
        text='\n'.join(page.get_text() for page in p)
        require(len(p)==21,'Unexpected PRD page count')
        require(all(f'FR-{i:02d}' in text for i in range(1,19)),'Missing PDF requirement')
        require(all(f'A{i}.' in text for i in range(1,7)),'Missing PDF design appendix')
        require(all(len(page.get_text().strip())>150 for page in p),'Potential blank PDF page')
        COUNTS['prd_pages']=len(p)
    return 'DOCX ZIP passes integrity check; 21-page PDF contains all 18 requirements and 6 design appendix sections; no blank page detected. Visual inspection is a separate recorded check.'


def package_files()->str:
    for name in ['README.md','AGENTS.md','HANDOFF_PROMPT.md','docs/01_PRD.md','docs/02_UX_SPEC.md','docs/03_ARCHITECTURE.md','tasks/BACKLOG.md','design/gallery.html','contracts/openapi.yaml']:
        require((ROOT/name).is_file(),'Missing entry-point '+name)
    fonts=[str(p.relative_to(ROOT)) for p in ROOT.rglob('*') if p.suffix.lower() in {'.ttf','.otf','.woff','.woff2','.ttc'}]
    require(not fonts,'Font files must not be distributed')
    return 'Core entry points exist; no font files distributed.'


def main()->int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,help='Optional report JSON path; default prints only.')
    args=parser.parse_args()
    for name,fn in [('JSON parsing',json_files),('JSON Schema and fixtures',schemas_and_examples),('OpenAPI limited structural checks',openapi_checks),('Task and requirement traceability',planning_checks),('Design asset integrity',design_checks),('SQL reference static inspection',sql_static_checks),('PRD reading copy checks',reading_copy_checks),('Package entry points',package_files)]:run(name,fn)
    report={'package':'RZ-Quran-Kids-Handoff-v1.0','validation_scope':'Documentation artifacts only; not application behavior or human approvals.','checks':RESULTS,'counts':COUNTS,'passed':all(x['status']=='pass' for x in RESULTS),'not_performed':['Complete OpenAPI semantic validation with a dedicated validator.','PostgreSQL syntax/runtime/migration/constraint execution.','Application build, auth integration, browser/e2e/load/security tests.','Scholarly review, asset licensing approval or legal compliance assessment.']}
    rendered=json.dumps(report,ensure_ascii=False,indent=2)
    print(rendered)
    if args.output:args.output.write_text(rendered+'\n',encoding='utf-8')
    return 0 if report['passed'] else 1

if __name__=='__main__':sys.exit(main())
