"""Update only questionnaire data, keeping the existing Explorer catalogue graph."""
import argparse
import json
from pathlib import Path
from catalogue import build, digest, require

def update(workbook, existing):
    generated = build(workbook)['explorer_catalog.json']
    old_ids = {b['blocker_id'] for b in existing['blockers']}
    new_ids = {b['blocker_id'] for b in generated['blockers']}
    require(old_ids == new_ids, 'Blocker IDs differ from the existing catalogue')
    result = dict(existing)
    result['questionnaires'] = generated['questionnaires']
    result['question_blocker'] = generated['question_blocker']
    result['questionnaire_source'] = generated['source']
    result['counts'] = {**existing['counts'], 'questionnaires':4, 'questions':112, 'question_blocker':112, 'rubrics':560}
    result['maps_version'] = digest(result['question_blocker'])
    result.pop('catalog_version', None)
    result['catalog_version'] = digest(result)
    return result

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook', type=Path)
    parser.add_argument('existing_catalog', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    existing = json.loads(args.existing_catalog.read_text(encoding='utf-8'))
    updated = update(args.workbook, existing)
    args.output.write_text(json.dumps(updated, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Updated questionnaire catalogue:', args.output)

if __name__ == '__main__':
    main()
