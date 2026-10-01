import unittest

from excel_to_explorer_json_v2 import STAGE_GATES, validate_gate


class StageGateTests(unittest.TestCase):
    def test_combined_zero_based_labels(self):
        for gate, label in STAGE_GATES.items():
            with self.subTest(gate=gate):
                self.assertEqual(validate_gate(f"Gate {gate - 1}- {label}", None, "test", []), (gate, label))

    def test_workbook_spacing_and_singular_operation(self):
        self.assertEqual(validate_gate("Gate 2- Solution Build &\nVerification", None, "test", [])[0], 3)
        self.assertEqual(validate_gate("Gate 4-Steady-State Operation & Evolution", None, "test", []), (5, STAGE_GATES[5]))

    def test_legacy_numeric_and_blanks(self):
        for gate, label in STAGE_GATES.items():
            self.assertEqual(validate_gate(gate, label, "test", []), (gate, label))
        self.assertEqual(validate_gate(None, None, "test", []), (None, None))

    def test_rejects_misnumbered_or_conflicting_labels(self):
        for value, description in [
            ("Gate 0-Solution Build & Verification", None),
            ("Gate 6-Retirement & Transition", None),
            ("Gate 2-Solution Build & Verification", "Retirement & Transition"),
        ]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_gate(value, description, "test", [])


if __name__ == "__main__":
    unittest.main()
