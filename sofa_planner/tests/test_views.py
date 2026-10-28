"""
Tests for sofa_planner. Run with:  python manage.py test sofa_planner

Only synthetic data. These run in the STANDALONE test project, so they prove
the module's own rules, not Portal integration.
"""
import json

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.test import Client, TestCase
from django.urls import reverse

from sofa_planner.models import SofaLayout

User = get_user_model()


def valid_layout_data():
    return {
        "pieces": [{"id": 1, "type": "arm", "name": "Arm (S)", "w": 12, "d": 82, "x": 190, "y": 110, "rot": 0}],
        "room": {"on": False, "w": 400, "d": 300, "unit": "ft"},
        "unit": "cm",
        "uid": 2,
        "scale": 2.4,
        "origin": "v2",
    }


class SofaPlannerTestBase(TestCase):
    @classmethod
    def setUpTestData(cls):
        perm = Permission.objects.get(codename="access_sofa_planner", content_type__app_label="sofa_planner")
        cls.alice = User.objects.create_user("alice.test", password="pw-alice")
        cls.bob = User.objects.create_user("bob.test", password="pw-bob")
        cls.carol = User.objects.create_user("carol.noaccess", password="pw-carol")  # no module permission
        cls.alice.user_permissions.add(perm)
        cls.bob.user_permissions.add(perm)
        cls.alice_layout = SofaLayout.objects.create(
            owner=cls.alice, name="Alice plan", sofa_model_name="Alvric Sofa", layout_data=valid_layout_data()
        )
        cls.bob_layout = SofaLayout.objects.create(
            owner=cls.bob, name="Bob plan", layout_data=valid_layout_data()
        )

    def save_body(self, user, version, **overrides):
        body = {
            "name": "Renamed",
            "sofa_model_name": "Amora Sofa",
            "layout_data": valid_layout_data(),
            "opened_as": user.pk,
            "version": version,
        }
        body.update(overrides)
        return json.dumps(body)

    def post_json(self, client, url, body):
        return client.post(url, data=body, content_type="application/json")


class AnonymousDeniedTests(SofaPlannerTestBase):
    def test_pages_redirect_to_sign_in(self):
        for url in [
            reverse("sofa_planner:layout_list"),
            reverse("sofa_planner:layout_new"),
            reverse("sofa_planner:layout_edit", args=[self.alice_layout.pk]),
        ]:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 302)
                self.assertIn(reverse("login"), response["Location"])

    def test_save_returns_401_json(self):
        url = reverse("sofa_planner:layout_save", args=[self.alice_layout.pk])
        response = self.post_json(self.client, url, self.save_body(self.alice, 1))
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["error"], "not_authenticated")
        self.alice_layout.refresh_from_db()
        self.assertEqual(self.alice_layout.version, 1)  # nothing changed

    def test_create_returns_401_json(self):
        response = self.post_json(self.client, reverse("sofa_planner:layout_create"), self.save_body(self.alice, 1))
        self.assertEqual(response.status_code, 401)
        self.assertEqual(SofaLayout.objects.count(), 2)

    def test_delete_redirects_and_keeps_record(self):
        url = reverse("sofa_planner:layout_delete", args=[self.alice_layout.pk])
        response = self.client.post(url)
        self.assertEqual(response.status_code, 302)
        self.assertTrue(SofaLayout.objects.filter(pk=self.alice_layout.pk).exists())

    def test_inactive_user_is_denied(self):
        self.alice.is_active = False
        self.alice.save()
        self.client.force_login(self.alice)  # pretend an old session still exists
        response = self.client.get(reverse("sofa_planner:layout_list"))
        # Django's auth backend rejects inactive users -> treated as signed out.
        self.assertEqual(response.status_code, 302)


class ModuleAccessTests(SofaPlannerTestBase):
    def test_user_without_module_permission_gets_403(self):
        self.client.force_login(self.carol)
        self.assertEqual(self.client.get(reverse("sofa_planner:layout_list")).status_code, 403)
        self.assertEqual(self.client.get(reverse("sofa_planner:layout_new")).status_code, 403)
        response = self.post_json(self.client, reverse("sofa_planner:layout_create"), self.save_body(self.carol, 1))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(SofaLayout.objects.count(), 2)


class OtherUsersLayoutTests(SofaPlannerTestBase):
    def setUp(self):
        self.client.force_login(self.alice)

    def test_list_shows_only_own_layouts(self):
        response = self.client.get(reverse("sofa_planner:layout_list"))
        self.assertContains(response, "Alice plan")
        self.assertNotContains(response, "Bob plan")

    def test_cannot_open_other_users_layout(self):
        response = self.client.get(reverse("sofa_planner:layout_edit", args=[self.bob_layout.pk]))
        self.assertEqual(response.status_code, 404)

    def test_cannot_save_other_users_layout(self):
        url = reverse("sofa_planner:layout_save", args=[self.bob_layout.pk])
        response = self.post_json(self.client, url, self.save_body(self.alice, 1))
        self.assertEqual(response.status_code, 404)
        self.bob_layout.refresh_from_db()
        self.assertEqual(self.bob_layout.name, "Bob plan")
        self.assertEqual(self.bob_layout.version, 1)

    def test_cannot_delete_other_users_layout(self):
        response = self.client.post(reverse("sofa_planner:layout_delete", args=[self.bob_layout.pk]))
        self.assertEqual(response.status_code, 404)
        self.assertTrue(SofaLayout.objects.filter(pk=self.bob_layout.pk).exists())

    def test_owner_in_body_is_ignored_on_create(self):
        body = json.loads(self.save_body(self.alice, 1))
        body["owner"] = self.bob.pk  # manually altered request
        response = self.post_json(self.client, reverse("sofa_planner:layout_create"), json.dumps(body))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(SofaLayout.objects.get(pk=response.json()["id"]).owner, self.alice)


class SaveMethodAndCsrfTests(SofaPlannerTestBase):
    def test_save_rejects_get(self):
        self.client.force_login(self.alice)
        for url in [
            reverse("sofa_planner:layout_save", args=[self.alice_layout.pk]),
            reverse("sofa_planner:layout_create"),
            reverse("sofa_planner:layout_delete", args=[self.alice_layout.pk]),
        ]:
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 405)

    def test_save_requires_csrf_token(self):
        csrf_client = Client(enforce_csrf_checks=True)  # the normal test client skips CSRF
        csrf_client.force_login(self.alice)
        url = reverse("sofa_planner:layout_save", args=[self.alice_layout.pk])
        response = self.post_json(csrf_client, url, self.save_body(self.alice, 1))
        self.assertEqual(response.status_code, 403)
        self.alice_layout.refresh_from_db()
        self.assertEqual(self.alice_layout.version, 1)

    def test_save_works_with_csrf_token(self):
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.alice)
        # Open the editor first: it sets the CSRF cookie, like a real browser.
        page = csrf_client.get(reverse("sofa_planner:layout_edit", args=[self.alice_layout.pk]))
        token = page.context["csrf_token"]
        url = reverse("sofa_planner:layout_save", args=[self.alice_layout.pk])
        response = csrf_client.post(
            url, data=self.save_body(self.alice, 1), content_type="application/json", HTTP_X_CSRFTOKEN=str(token)
        )
        self.assertEqual(response.status_code, 200)

    def test_delete_requires_csrf_token(self):
        csrf_client = Client(enforce_csrf_checks=True)
        csrf_client.force_login(self.alice)
        response = csrf_client.post(reverse("sofa_planner:layout_delete", args=[self.alice_layout.pk]))
        self.assertEqual(response.status_code, 403)
        self.assertTrue(SofaLayout.objects.filter(pk=self.alice_layout.pk).exists())


class VersionTests(SofaPlannerTestBase):
    def setUp(self):
        self.client.force_login(self.alice)
        self.url = reverse("sofa_planner:layout_save", args=[self.alice_layout.pk])

    def test_good_version_saves_and_increments(self):
        response = self.post_json(self.client, self.url, self.save_body(self.alice, 1))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["version"], 2)
        self.alice_layout.refresh_from_db()
        self.assertEqual(self.alice_layout.name, "Renamed")
        self.assertEqual(self.alice_layout.version, 2)

    def test_stale_version_is_rejected(self):
        # Tab 1 saves first (version 1 -> 2).
        self.assertEqual(self.post_json(self.client, self.url, self.save_body(self.alice, 1)).status_code, 200)
        # Tab 2 still thinks it is version 1.
        response = self.post_json(self.client, self.url, self.save_body(self.alice, 1, name="Old tab"))
        self.assertEqual(response.status_code, 409)
        data = response.json()
        self.assertEqual(data["error"], "version_conflict")
        self.assertEqual(data["current_version"], 2)
        self.alice_layout.refresh_from_db()
        self.assertEqual(self.alice_layout.name, "Renamed")  # not overwritten
        self.assertEqual(self.alice_layout.version, 2)

    def test_missing_version_is_rejected(self):
        body = json.loads(self.save_body(self.alice, 1))
        del body["version"]
        response = self.post_json(self.client, self.url, json.dumps(body))
        self.assertEqual(response.status_code, 400)
        self.assertIn("version", response.json()["fields"])

    def test_identity_changed_is_rejected(self):
        # Page was opened by Bob, but Alice is signed in now (user switch in another tab).
        response = self.post_json(self.client, self.url, self.save_body(self.bob, 1))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"], "identity_changed")


class ValidationTests(SofaPlannerTestBase):
    def setUp(self):
        self.client.force_login(self.alice)
        self.url = reverse("sofa_planner:layout_save", args=[self.alice_layout.pk])

    def assert_rejected(self, body, field):
        response = self.post_json(self.client, self.url, body)
        self.assertEqual(response.status_code, 400)
        self.assertIn(field, response.json()["fields"])
        self.alice_layout.refresh_from_db()
        self.assertEqual(self.alice_layout.version, 1)

    def test_invalid_json(self):
        response = self.post_json(self.client, self.url, "{not json")
        self.assertEqual(response.status_code, 400)

    def test_empty_name(self):
        self.assert_rejected(self.save_body(self.alice, 1, name="  "), "name")

    def test_bad_unit(self):
        data = valid_layout_data()
        data["unit"] = "mm"
        self.assert_rejected(self.save_body(self.alice, 1, layout_data=data), "layout_data.unit")

    def test_unknown_layout_key(self):
        data = valid_layout_data()
        data["price"] = 999
        self.assert_rejected(self.save_body(self.alice, 1, layout_data=data), "layout_data")

    def test_piece_size_out_of_range(self):
        data = valid_layout_data()
        data["pieces"][0]["w"] = 99999
        self.assert_rejected(self.save_body(self.alice, 1, layout_data=data), "layout_data.pieces[0].w")

    def test_html_in_piece_name_rejected(self):
        data = valid_layout_data()
        data["pieces"][0]["name"] = "<img src=x>"
        self.assert_rejected(self.save_body(self.alice, 1, layout_data=data), "layout_data.pieces[0].name")

    def test_html_in_sofa_model_name_rejected(self):
        self.assert_rejected(self.save_body(self.alice, 1, sofa_model_name="<b>x</b>"), "sofa_model_name")


class DeleteTests(SofaPlannerTestBase):
    def test_owner_can_delete(self):
        self.client.force_login(self.alice)
        response = self.client.post(reverse("sofa_planner:layout_delete", args=[self.alice_layout.pk]))
        self.assertRedirects(response, reverse("sofa_planner:layout_list"))
        self.assertFalse(SofaLayout.objects.filter(pk=self.alice_layout.pk).exists())


class PaginationTests(SofaPlannerTestBase):
    def test_default_page_size_is_25(self):
        SofaLayout.objects.bulk_create(
            [SofaLayout(owner=self.alice, name=f"Fake {i:02d}", layout_data=valid_layout_data()) for i in range(30)]
        )
        self.client.force_login(self.alice)
        response = self.client.get(reverse("sofa_planner:layout_list"))
        page = response.context["page_obj"]
        self.assertEqual(page.paginator.per_page, 25)
        self.assertEqual(len(page.object_list), 25)
        self.assertEqual(page.paginator.count, 31)  # 30 + the one from setUpTestData
        second = self.client.get(reverse("sofa_planner:layout_list"), {"page": 2})
        self.assertEqual(len(second.context["page_obj"].object_list), 6)

    def test_bad_page_number_does_not_crash(self):
        self.client.force_login(self.alice)
        response = self.client.get(reverse("sofa_planner:layout_list"), {"page": "abc"})
        self.assertEqual(response.status_code, 200)


class PrivacyHeaderTests(SofaPlannerTestBase):
    def test_pages_are_not_cached(self):
        self.client.force_login(self.alice)
        response = self.client.get(reverse("sofa_planner:layout_list"))
        self.assertIn("no-store", response["Cache-Control"])
        self.assertIn("private", response["Cache-Control"])
