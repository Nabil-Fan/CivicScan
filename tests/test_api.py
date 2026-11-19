import unittest
import json
from app import app
import pipeline as P


class TestAppAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config["TESTING"] = True
        cls.client = app.test_client()
        # Pastikan model sudah dilatih
        if not P.MODELS_PATH.exists() or not P.SUMMARY_PATH.exists():
            engine = P.SpatialRegressionEngine(P.DEFAULT_DATASET)
            engine.run_all()

    def test_get_index(self):
        resp = self.client.get("/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn(b"CivicScan", resp.data)
        resp.close()

        # Legacy Jinja endpoint test
        resp_leg = self.client.get("/?legacy=1")
        self.assertEqual(resp_leg.status_code, 200)
        self.assertIn(b"CivicScan", resp_leg.data)
        self.assertIn(b"spatial-map", resp_leg.data)
        self.assertIn(b"Kondisi Nyata Lapangan", resp_leg.data)
        self.assertIn(b"insp-winner-badge", resp_leg.data)
        self.assertIn(b"insp-narrative", resp_leg.data)
        self.assertIn(b"quick-county", resp_leg.data)
        self.assertIn(b"btn-tour-atlanta", resp_leg.data)
        resp_leg.close()

    def test_get_results(self):
        resp = self.client.get("/results")
        self.assertEqual(resp.status_code, 200)
        resp.close()

        resp_leg = self.client.get("/results?legacy=1")
        self.assertEqual(resp_leg.status_code, 200)
        self.assertIn(b"Hasil Eksperimen", resp_leg.data)
        self.assertIn(b"tbl-main-comparison", resp_leg.data)
        self.assertIn(b"Di Mana GWR Menang", resp_leg.data)
        self.assertIn(b"Batasan & Risiko", resp_leg.data)
        resp_leg.close()

    def test_get_cara_kerja(self):
        resp = self.client.get("/cara-kerja")
        self.assertEqual(resp.status_code, 200)
        resp.close()

        resp_leg = self.client.get("/cara-kerja?legacy=1")
        self.assertEqual(resp_leg.status_code, 200)
        self.assertIn(b"Cara Kerja", resp_leg.data)
        self.assertIn(b"Tobler", resp_leg.data)
        self.assertIn(b"Termometer", resp_leg.data)
        self.assertIn(b"Sensor Cuaca", resp_leg.data)
        resp_leg.close()
        self.assertIn(b"Kamus Simbol", resp_leg.data)

    def test_api_status(self):
        resp = self.client.get("/api/status")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertTrue(data["ready"])
        self.assertIn("target", data)
        self.assertIn("features", data)
        self.assertGreater(data["n_samples"], 0)

    def test_api_results(self):
        resp = self.client.get("/api/results")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("ols", data)
        self.assertIn("gwr", data)
        self.assertIn("moran", data)
        self.assertIn("anova", data)
        self.assertIn("comparison", data)

    def test_api_spatial_points(self):
        resp = self.client.get("/api/spatial-points")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIsInstance(data, list)
        self.assertGreater(len(data), 0)
        # Check first point structure
        p0 = data[0]
        self.assertIn("lat", p0)
        self.assertIn("lon", p0)
        self.assertIn("observed", p0)
        self.assertIn("pred_ols", p0)
        self.assertIn("pred_gwr", p0)
        self.assertIn("local_betas", p0)

    def test_api_papers(self):
        resp = self.client.get("/api/papers")
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertGreaterEqual(data["total"], 20)
        self.assertEqual(len(data["papers"]), data["total"])
        self.assertIn("title", data["papers"][0])
        self.assertIn("authors", data["papers"][0])

    def test_api_predict_valid(self):
        payload = {
            "x": 941396.6,
            "y": 3521764.0,
            "features": {
                "PctPov": 20.0,
                "PctBlack": 15.0,
                "PctRural": 50.0
            }
        }
        resp = self.client.post("/api/predict", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.get_json()
        self.assertIn("pred_ols", data)
        self.assertIn("pred_gwr", data)
        self.assertIn("local_betas_gwr", data)
        self.assertIn("global_betas_ols", data)
        self.assertIn("interpretation", data)

    def test_api_predict_missing_coords(self):
        payload = {
            "features": {"PctPov": 20.0}
        }
        resp = self.client.post("/api/predict", json=payload)
        self.assertEqual(resp.status_code, 400)
        data = resp.get_json()
        self.assertIn("error", data)


if __name__ == "__main__":
    unittest.main()
