import unittest
from unittest.mock import patch

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from backend.app import request_logging
from backend.app.request_logging import install_request_logging


def test_app() -> FastAPI:
    app = FastAPI()
    install_request_logging(app)

    @app.get("/ok")
    def ok():
        return {"ok": True}

    @app.get("/missing")
    def missing():
        raise HTTPException(status_code=404, detail="대상을 찾을 수 없습니다.")

    @app.get("/broken")
    def broken():
        raise RuntimeError("database password must not be logged")

    @app.get("/items/{item_id}")
    def item(item_id: int):
        return {"item_id": item_id}

    return app


class RequestLoggingTest(unittest.TestCase):
    def setUp(self):
        self.logging_enabled = patch.object(request_logging.settings, "request_log_enabled", True)
        self.logging_enabled.start()

    def tearDown(self):
        self.logging_enabled.stop()

    def test_success_log_uses_route_template_and_returns_request_id(self):
        with patch("backend.app.request_logging.emit_request_log") as emit:
            response = TestClient(test_app()).get(
                "/items/42",
                headers={"X-Request-ID": "request-123"},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["X-Request-ID"], "request-123")
        payload = emit.call_args.args[0]
        self.assertEqual(payload["path"], "/items/{item_id}")
        self.assertIsNone(payload["error"])

    def test_http_error_is_included_as_structured_json_data(self):
        with patch("backend.app.request_logging.emit_request_log") as emit:
            response = TestClient(test_app()).get("/missing")

        self.assertEqual(response.status_code, 404)
        error = emit.call_args.args[0]["error"]
        self.assertEqual(error["code"], "HTTP_404")
        self.assertEqual(error["message"], "대상을 찾을 수 없습니다.")

    def test_unhandled_error_does_not_log_exception_message(self):
        with patch("backend.app.request_logging.emit_request_log") as emit:
            response = TestClient(test_app(), raise_server_exceptions=False).get("/broken")

        self.assertEqual(response.status_code, 500)
        error = emit.call_args.args[0]["error"]
        self.assertEqual(error["code"], "INTERNAL_SERVER_ERROR")
        self.assertEqual(error["type"], "RuntimeError")
        self.assertNotIn("password", error["message"])


if __name__ == "__main__":
    unittest.main()
