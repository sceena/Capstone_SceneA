import json
import unittest

from app.services.question_generator import QuestionGenerator


class CountingQuestionGenerator(QuestionGenerator):
    def __init__(self) -> None:
        super().__init__(timeout_sec=5)
        self.common_calls = 0
        self.personal_calls = 0

    def _call_common_llm(self, candidates):
        self.common_calls += 1
        return json.dumps([f"common question {index}?" for index in range(1, 6)])

    def _call_group_personal_llm(self, document):
        self.personal_calls += 1
        return json.dumps([f"personal question {index}?" for index in range(1, 6)])


class QuestionGeneratorTest(unittest.TestCase):
    def test_group_session_uses_one_common_call_and_one_personal_call_per_candidate(self):
        generator = CountingQuestionGenerator()

        result = generator.generate_for_session(
            "GROUP",
            [
                {"candidate_id": 1, "content": "Spring Boot project"},
                {"candidate_id": 2, "content": "React project"},
                {"candidate_id": 3, "content": "NestJS project"},
                {"candidate_id": 4, "content": "FastAPI project"},
            ],
        )

        self.assertEqual(generator.common_calls, 1)
        self.assertEqual(generator.personal_calls, 4)
        self.assertEqual(result["session_type"], "GROUP")
        self.assertEqual(len(result["common_questions"]), 5)
        self.assertEqual(len(result["personal_questions"]), 4)
        for personal_question_set in result["personal_questions"]:
            self.assertEqual(len(personal_question_set["questions"]), 5)


if __name__ == "__main__":
    unittest.main()
