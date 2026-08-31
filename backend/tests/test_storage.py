import io
import unittest
from unittest.mock import patch

from starlette.datastructures import Headers

from backend.app import storage
from fastapi import UploadFile


class FakeS3Client:
    def __init__(self):
        self.upload = None

    def upload_fileobj(self, Fileobj, Bucket, Key, ExtraArgs):
        self.upload = {
            "body": Fileobj.read(),
            "bucket": Bucket,
            "key": Key,
            "extra_args": ExtraArgs,
        }


def image_upload(body: bytes = b"image-data") -> UploadFile:
    return UploadFile(
        file=io.BytesIO(body),
        filename="living-room.png",
        headers=Headers({"content-type": "image/png"}),
    )


class R2StorageTest(unittest.TestCase):
    def test_uploads_to_r2_and_returns_public_url(self):
        client = FakeS3Client()
        configured = {
            "storage_backend": "r2",
            "r2_account_id": "account-id",
            "r2_access_key_id": "access-key",
            "r2_secret_access_key": "secret-key",
            "r2_bucket_name": "jeil-interior",
            "r2_public_base_url": "https://images.example.com/",
        }

        with patch.multiple(storage.settings, **configured), patch.object(storage, "_r2_client", return_value=client):
            key, url, size = storage.save_upload("project-id", image_upload())

        self.assertTrue(key.startswith("project-id/"))
        self.assertTrue(key.endswith(".png"))
        self.assertEqual(url, f"https://images.example.com/{key}")
        self.assertEqual(size, len(b"image-data"))
        self.assertEqual(client.upload["body"], b"image-data")
        self.assertEqual(client.upload["bucket"], "jeil-interior")
        self.assertEqual(client.upload["extra_args"]["ContentType"], "image/png")

    def test_rejects_oversized_upload_before_r2_request(self):
        with patch.object(storage.settings, "storage_backend", "r2"), patch.object(storage, "_r2_client") as client:
            with self.assertRaisesRegex(ValueError, "1MB"):
                storage.save_media_upload("project-id", image_upload(b"x" * (1024 * 1024 + 1)), storage.ALLOWED_TYPES, 1024 * 1024)

        client.assert_not_called()

    def test_reports_missing_r2_configuration(self):
        configured = {
            "storage_backend": "r2",
            "r2_account_id": "",
            "r2_access_key_id": "",
            "r2_secret_access_key": "",
            "r2_bucket_name": "",
            "r2_public_base_url": "",
        }

        with patch.multiple(storage.settings, **configured):
            with self.assertRaisesRegex(storage.StorageUploadError, "R2_ACCOUNT_ID"):
                storage.save_upload("project-id", image_upload())


if __name__ == "__main__":
    unittest.main()
