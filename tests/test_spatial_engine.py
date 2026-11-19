import unittest
import numpy as np
import pandas as pd
from pathlib import Path
import json

from pipeline import SpatialRegressionEngine, ROOT, DATA_DIR, RESULTS_DIR


class TestSpatialRegressionEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset_path = DATA_DIR / "georgia_benchmark.csv"
        cls.engine = SpatialRegressionEngine(data_path=cls.dataset_path)

    def test_audit(self):
        info = self.engine.audit()
        self.assertEqual(info["observations"], 159)
        self.assertEqual(info["target"], "PctBach")
        self.assertEqual(len(info["features"]), 3)
        self.assertIn("PctPov", info["vif"])
        # All VIFs should be reasonable (< 5 in Georgia dataset)
        for var, vif in info["vif"].items():
            self.assertLess(vif, 10.0, f"VIF for {var} is too high: {vif}")

    def test_fit_ols(self):
        ols = self.engine.fit_ols()
        self.assertGreater(ols["r2"], 0.45)
        self.assertLess(ols["r2"], 0.55)
        self.assertGreater(ols["aicc"], 800)
        self.assertEqual(len(ols["coefficients"]), 4)  # Intercept + 3 features
        self.assertEqual(len(ols["residuals"]), 159)

    def test_fit_gwr(self):
        gwr = self.engine.fit_gwr(kernel="bisquare", adaptive=True)
        # GWR R2 must be higher than OLS R2
        self.assertGreater(gwr["r2"], 0.55)
        # GWR AICc must be lower than OLS AICc
        self.assertLess(gwr["aicc"], 905)
        self.assertGreater(gwr["bandwidth"], 0)
        self.assertEqual(len(gwr["coefficients_summary"]), 4)
        self.assertEqual(len(gwr["residuals"]), 159)

    def test_spatial_autocorrelation_moran(self):
        ols = self.engine.fit_ols()
        gwr = self.engine.fit_gwr(kernel="bisquare", adaptive=True)
        moran = self.engine.compute_spatial_autocorrelation(
            np.array(ols["residuals"]),
            np.array(gwr["residuals"]),
            k_neighbors=6
        )
        self.assertIn("ols_moran_i", moran)
        self.assertIn("gwr_moran_i", moran)
        # Moran I for GWR should be reduced compared to OLS
        self.assertLess(moran["gwr_moran_i"], moran["ols_moran_i"])

    def test_anova_comparison(self):
        ols = self.engine.fit_ols()
        gwr = self.engine.fit_gwr(kernel="bisquare", adaptive=True)
        anova = self.engine.anova_comparison(
            ols["rss"],
            gwr["rss"],
            self.engine.n - (self.engine.k + 1),
            self.engine.n - gwr["effective_parameters"]
        )
        self.assertIn("f_statistic", anova)
        self.assertIn("p_value", anova)
        self.assertTrue(anova["is_significant"])

    def test_full_pipeline_run(self):
        summary = self.engine.run_all()
        self.assertIn("comparison", summary)
        self.assertIn("delta_r2", summary["comparison"])
        self.assertGreater(summary["comparison"]["delta_r2"], 0.0)
        self.assertLess(summary["comparison"]["delta_aicc"], 0.0)

        # Check artifact existence
        self.assertTrue((RESULTS_DIR / "summary.json").exists())
        self.assertTrue((RESULTS_DIR / "models.joblib").exists())
        self.assertTrue((RESULTS_DIR / "spatial_points.json").exists())
        self.assertTrue((RESULTS_DIR / "comparison_table.tex").exists())


if __name__ == "__main__":
    unittest.main()
