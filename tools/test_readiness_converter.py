import copy
import unittest
from excel_to_explorer_json_v2 import read_readiness, STAGE_GATES

class Reader:
    def __init__(self):
        self.sheets = {
            "Readiness_Questions": [
                ["Title"], ["Context"], [],
                ["Question_ID","Question","Dimension","Lifecycle_Stage","Provisional_Stage_Gate","Guidance","Evidence_Examples","Applicability","Review_Status","Review_Comments","Source_Blocker_IDs","Source_Stage_Gates"],
                ["RQ-1-01","Can users interpret outputs?","Technical; Cross-cutting",STAGE_GATES[3],3,"Check each component","Trial; Review","Relevant users","Draft - UIC review","Pending","1; 2","1: Gate 3; 2: Gate 3"],
            ],
            "Question_Blocker_Map": [
                ["Question_ID","Blocker_ID","Blocker_Code","Blocker_Title","Relationship","Rationale","Review_Status","Review_Comments"],
                ["RQ-1-01",1,"B-1","Trust","Direct","Explicit assessment","Draft - UIC review","Pending"],
                ["RQ-1-01",2,None,"Explainability","Direct","Explicit assessment","Draft - UIC review","Pending"],
                ["RQ-1-01",3,"B-3","Skills","Contextual","Supporting context","Draft - UIC review","Pending"],
            ],
        }
    def sheet_names(self):return list(self.sheets)
    def read_sheet(self,name):return self.sheets[name]

class ReadinessTests(unittest.TestCase):
    def setUp(self):
        self.reader=Reader()
        self.blockers=[{"id":1,"code":"B-1","title":"Trust"},{"id":2,"code":None,"title":"Explainability"},{"id":3,"code":"B-3","title":"Skills"}]
    def run_conversion(self):return read_readiness(self.reader,self.blockers)
    def test_grouped_questions_preserve_drafts_and_blank_codes(self):
        questions,mappings=self.run_conversion()
        self.assertEqual(questions[0]["sourceBlockerIds"],[1,2])
        self.assertEqual(questions[0]["evidenceExamples"],["Trial","Review"])
        self.assertEqual(questions[0]["reviewStatus"],"Draft - UIC review")
        self.assertIsNone(mappings[1]["blockerCode"])
        self.assertEqual(mappings[2]["relationship"],"Contextual")
    def test_legacy_workbooks(self):
        self.reader.sheets={}
        self.assertEqual(self.run_conversion(),([],[]))
    def test_requires_both_sheets(self):
        del self.reader.sheets["Question_Blocker_Map"]
        with self.assertRaises(ValueError):self.run_conversion()
    def test_duplicate_question_ids(self):
        self.reader.sheets["Readiness_Questions"].append(copy.deepcopy(self.reader.sheets["Readiness_Questions"][-1]))
        with self.assertRaises(ValueError):self.run_conversion()
    def test_unknown_and_duplicate_mapping_references(self):
        for value in [999,"RQ-unknown"]:
            with self.subTest(value=value):
                self.reader=Reader();self.reader.sheets["Question_Blocker_Map"][1][1 if isinstance(value,int) else 0]=value
                with self.assertRaises(ValueError):self.run_conversion()
        self.reader=Reader();self.reader.sheets["Question_Blocker_Map"].append(copy.deepcopy(self.reader.sheets["Question_Blocker_Map"][1]))
        with self.assertRaises(ValueError):self.run_conversion()
    def test_bad_gate_and_conflicting_lifecycle(self):
        for gate in [6,1]:
            self.reader=Reader();self.reader.sheets["Readiness_Questions"][-1][4]=gate
            with self.assertRaises(ValueError):self.run_conversion()
    def test_invalid_status_or_relationship(self):
        for col,value in [(4,"Validated"),(6,"Approved automatically")]:
            self.reader=Reader();self.reader.sheets["Question_Blocker_Map"][1][col]=value
            with self.assertRaises(ValueError):self.run_conversion()
    def test_source_direct_mapping_consistency(self):
        self.reader.sheets["Question_Blocker_Map"][1][4]="Contextual"
        with self.assertRaises(ValueError):self.run_conversion()
    def test_stale_blocker_metadata(self):
        self.reader.sheets["Question_Blocker_Map"][1][3]="Outdated title"
        with self.assertRaises(ValueError):self.run_conversion()

if __name__=="__main__":unittest.main()
