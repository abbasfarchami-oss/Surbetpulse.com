"""Real Cloud policy checks. Run with python3 src/test/cloud_access.integration.py.

Requires sandbox Cloud credentials. Creates only temporary example.com accounts,
never personal owner credentials, and removes those accounts and rows afterward.
"""
import json
import os
import secrets
import unittest
import urllib.error
import urllib.request


class CloudAccessTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.url = os.environ["SUPABASE_URL"]
        cls.admin_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        cls.public_key = os.environ["SUPABASE_PUBLISHABLE_KEY"]
        cls.users = []
        cls.identities = {}
        for label in ("regular", "admin", "unverified"):
            email = f"policy-{label}-{secrets.token_hex(6)}@example.com"
            password = secrets.token_urlsafe(24)
            status, user = cls.call("/auth/v1/admin/users", "POST", {
                "email": email, "password": password,
                "email_confirm": label != "unverified",
            }, privileged=True)
            if status not in (200, 201):
                raise RuntimeError("Temporary test account creation failed")
            uid = user["id"]
            cls.users.append(uid)
            token = None
            if label != "unverified":
                status, session = cls.call("/auth/v1/token?grant_type=password", "POST", {"email": email, "password": password})
                if status != 200:
                    raise RuntimeError("Temporary test login failed")
                token = session["access_token"]
            cls.identities[label] = (uid, token)
            if label == "admin":
                cls.call("/rest/v1/user_roles", "POST", {"user_id": uid, "role": "admin"}, privileged=True)

    @classmethod
    def tearDownClass(cls):
        for uid in cls.users:
            cls.call("/rest/v1/subscriptions?user_id=eq." + uid, "DELETE", privileged=True)
            cls.call("/auth/v1/admin/users/" + uid, "DELETE", privileged=True)

    @classmethod
    def call(cls, path, method="GET", body=None, token=None, privileged=False):
        headers = {"apikey": cls.admin_key if privileged else cls.public_key, "Content-Type": "application/json", "Prefer": "return=representation"}
        if token:
            headers["Authorization"] = "Bearer " + token
        request = urllib.request.Request(cls.url + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request) as response:
                return response.status, json.loads(response.read() or "null")
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read() or "null")

    def test_regular_user_cannot_become_pro(self):
        uid, token = self.identities["regular"]
        status, _ = self.call("/rest/v1/subscriptions", "POST", {"user_id": uid, "plan_id": "p2", "status": "active"}, token)
        self.assertEqual(status, 403)

    def test_regular_user_cannot_assign_admin(self):
        uid, token = self.identities["regular"]
        status, _ = self.call("/rest/v1/user_roles", "POST", {"user_id": uid, "role": "admin"}, token)
        self.assertEqual(status, 403)

    def test_regular_user_cannot_change_settings(self):
        _, token = self.identities["regular"]
        status, rows = self.call("/rest/v1/app_settings?key=eq.error_threshold", "PATCH", {"value": 201}, token)
        self.assertEqual(status, 200)
        self.assertEqual(rows, [])

    def test_regular_user_cannot_update_existing_subscription(self):
        uid, token = self.identities["regular"]
        status, _ = self.call("/rest/v1/subscriptions", "POST", {"user_id": uid, "plan_id": "p1", "status": "active"}, privileged=True)
        self.assertEqual(status, 201)
        status, rows = self.call("/rest/v1/subscriptions?user_id=eq." + uid, "PATCH", {"plan_id": "p2"}, token)
        self.assertEqual(status, 200)
        self.assertEqual(rows, [])
        status, rows = self.call("/rest/v1/subscriptions?user_id=eq." + uid, token=token)
        self.assertEqual(rows[0]["plan_id"], "p1")

    def test_current_catalog_defaults_are_seeded(self):
        status, plans = self.call("/rest/v1/plans?select=config&order=position")
        self.assertEqual(status, 200)
        self.assertEqual([p["config"]["price"] for p in plans], [10, 100, 50, 30, 80, 1000])
        status, settings = self.call("/rest/v1/app_settings?key=eq.error_threshold")
        self.assertEqual(settings[0]["value"], 200)
        status, settings = self.call("/rest/v1/app_settings?key=eq.book_pricing")
        pricing = settings[0]["value"]
        self.assertEqual(pricing["base"], 20)
        self.assertEqual(pricing["included"], ["1xBet", "Pinnacle", "Bet365"])
        self.assertEqual(len(pricing["prices"]), 31)

    def test_public_reads_only_display_settings(self):
        status, settings = self.call("/rest/v1/app_settings?select=key")
        self.assertEqual(status, 200)
        self.assertEqual({row["key"] for row in settings}, {"book_pricing", "error_threshold", "regional_keywords", "bet_mode"})

    def test_subscription_reads_are_owner_only(self):
        admin_id, admin_token = self.identities["admin"]
        _, regular_token = self.identities["regular"]
        status, _ = self.call("/rest/v1/subscriptions", "POST", {"user_id": admin_id, "plan_id": "p2", "status": "active"}, admin_token)
        self.assertEqual(status, 201)
        status, rows = self.call("/rest/v1/subscriptions?user_id=eq." + admin_id, token=regular_token)
        self.assertEqual(status, 200)
        self.assertEqual(rows, [])
        status, rows = self.call("/rest/v1/subscriptions?user_id=eq." + admin_id, token=admin_token)
        self.assertEqual(status, 200)
        self.assertEqual(rows[0]["plan_id"], "p2")

    def test_unverified_nonowner_signup_has_no_role(self):
        uid, _ = self.identities["unverified"]
        status, rows = self.call("/rest/v1/user_roles?user_id=eq." + uid, privileged=True)
        self.assertEqual(status, 200)
        self.assertEqual(rows, [])

    def test_role_check_uses_authenticated_identity(self):
        uid, token = self.identities["regular"]
        status, result = self.call("/rest/v1/rpc/has_role", "POST", {"_user_id": uid, "_role": "admin"}, token)
        self.assertEqual(status, 200)
        self.assertFalse(result)
        admin_id, admin_token = self.identities["admin"]
        status, result = self.call("/rest/v1/rpc/has_role", "POST", {"_user_id": admin_id, "_role": "admin"}, admin_token)
        self.assertEqual(status, 200)
        self.assertTrue(result)


if __name__ == "__main__":
    unittest.main()