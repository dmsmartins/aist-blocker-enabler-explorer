"""Validate the consolidated Excel master and export the three website datasets."""
import argparse
import json
import sys
from pathlib import Path
from catalogue import build


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook',nargs='?',type=Path,default=Path(__file__).with_name('AIST_Explorer_Master.xlsx'))
    parser.add_argument('--output-dir',type=Path,default=Path(__file__).with_name('data'))
    parser.add_argument('--check-only',action='store_true',help='Validate and build in memory; write no files')
    args=parser.parse_args()
    try:
        data=build(args.workbook)
        encoded={name:json.dumps(payload,ensure_ascii=False,indent=2,allow_nan=False)+'\n' for name,payload in data.items()}
        if not args.check_only:
            args.output_dir.mkdir(parents=True,exist_ok=True)
            for name,content in encoded.items():
                target=args.output_dir/name
                temp=target.with_suffix('.json.tmp')
                temp.write_text(content,encoding='utf-8')
                temp.replace(target)
        counts=data['explorer_catalog.json']['counts']
        print('Validation passed: '+', '.join(f'{v} {k}' for k,v in counts.items()))
        print('Check-only: no files written.' if args.check_only else f'Exported {len(data)} JSON files to {args.output_dir.resolve()}')
        return 0
    except (ValueError,KeyError,OSError,TypeError) as exc:
        print(f'ERROR: {exc}',file=sys.stderr)
        return 1


if __name__=='__main__':
    raise SystemExit(main())
