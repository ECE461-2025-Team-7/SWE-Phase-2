//app/backend/src/routes/license-check.js
import express from "express";
import DataPipeline from "../pipelines/DataPipeline.js";
import { requireAuth, validateIdParam } from "../utils/http-helpers.js";

const router = express.Router();
const pipeline = new DataPipeline();

// Compatible license mappings
const LICENSE_COMPATIBILITY = {
  MIT: ["MIT", "Apache-2.0", "BSD", "ISC", "CC0", "Unlicense", "WTFPL"],
  "Apache-2.0": ["Apache-2.0", "MIT", "BSD", "ISC"],
  BSD: ["BSD", "MIT", "Apache-2.0", "ISC"],
  "GPL-2.0": ["GPL-2.0", "GPL-3.0", "AGPL-3.0"],
  "GPL-3.0": ["GPL-3.0", "AGPL-3.0"],
  "LGPL-2.1": ["LGPL-2.1", "LGPL-3.0", "GPL-2.0", "GPL-3.0"],
  "LGPL-3.0": ["LGPL-3.0", "GPL-3.0"],
  "AGPL-3.0": ["AGPL-3.0"],
  "CC-BY-4.0": ["CC-BY-4.0", "CC-BY-SA-4.0"],
  "CC-BY-SA-4.0": ["CC-BY-SA-4.0"],
};

/**
 * POST /artifact/model/:id/license-check
 * Check license compatibility between a model and a GitHub repository
 */
router.post("/:id/license-check", requireAuth, validateIdParam, async (req, res) => {
  try {
    const { id } = req.params;
    const { github_url } = req.body || {};

    // Validate request body
    if (!github_url || typeof github_url !== "string") {
      return res.status(400).json({
        error:
          "The license check request is malformed or references an unsupported usage context.",
      });
    }

    // Validate GitHub URL
    let owner, repo;
    try {
      const url = new URL(github_url);
      if (!url.hostname.includes("github.com")) {
        return res.status(400).json({
          error:
            "The license check request is malformed or references an unsupported usage context.",
        });
      }

      const pathParts = url.pathname.split("/").filter((p) => p);
      if (pathParts.length < 2) {
        return res.status(400).json({
          error:
            "The license check request is malformed or references an unsupported usage context.",
        });
      }

      owner = pathParts[0];
      repo = pathParts[1];
    } catch {
      return res.status(400).json({
        error:
          "The license check request is malformed or references an unsupported usage context.",
      });
    }

    // Get the model artifact
    const artifact = await pipeline.getArtifact({ type: "model", id });
    if (!artifact) {
      return res
        .status(404)
        .json({ error: "The artifact or GitHub project could not be found." });
    }

    // Extract model license from metadata
    const modelLicense = artifact.metadata?.license || extractLicenseFromData(artifact);
    if (!modelLicense) {
      // If no license info, assume incompatible
      return res.status(200).json(false);
    }

    // Fetch GitHub repository license
    let repoLicense;
    try {
      repoLicense = await fetchGitHubLicense(owner, repo);
    } catch (error) {
      console.error("Failed to fetch GitHub license:", error);
      return res
        .status(502)
        .json({ error: "External license information could not be retrieved." });
    }

    if (!repoLicense) {
      return res
        .status(404)
        .json({ error: "The artifact or GitHub project could not be found." });
    }

    // Check compatibility
    const compatible = checkLicenseCompatibility(modelLicense, repoLicense);

    return res.status(200).json(compatible);
  } catch (error) {
    console.error("License check error:", error);
    return res.status(400).json({
      error:
        "The license check request is malformed or references an unsupported usage context.",
    });
  }
});

/**
 * Fetch license information from GitHub repository
 */
async function fetchGitHubLicense(owner, repo) {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const headers = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "ECE461-Registry",
  };

  if (GITHUB_TOKEN) {
    headers["Authorization"] = `token ${GITHUB_TOKEN}`;
  }

  // Fetch license info from GitHub API
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/license`, {
    headers,
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const data = await response.json();
  const license = data.license?.spdx_id || data.license?.key;

  return normalizeLicense(license);
}

/**
 * Extract license from artifact data
 */
function extractLicenseFromData(artifact) {
  const data = artifact.data || {};

  // Check common license fields
  if (data.license) return normalizeLicense(data.license);
  if (data.license_name) return normalizeLicense(data.license_name);
  if (data.license_id) return normalizeLicense(data.license_id);

  return null;
}

/**
 * Normalize license names to SPDX identifiers
 */
function normalizeLicense(license) {
  if (!license) return null;

  const normalized = license.toString().toUpperCase().trim();

  // Map common variants to SPDX
  const mappings = {
    MIT: "MIT",
    APACHE: "Apache-2.0",
    "APACHE-2": "Apache-2.0",
    "APACHE-2.0": "Apache-2.0",
    APACHE2: "Apache-2.0",
    BSD: "BSD",
    "BSD-3-CLAUSE": "BSD",
    GPL: "GPL-3.0",
    "GPL-2": "GPL-2.0",
    "GPL-2.0": "GPL-2.0",
    "GPL-3": "GPL-3.0",
    "GPL-3.0": "GPL-3.0",
    LGPL: "LGPL-3.0",
    "LGPL-2.1": "LGPL-2.1",
    "LGPL-3.0": "LGPL-3.0",
    AGPL: "AGPL-3.0",
    "AGPL-3.0": "AGPL-3.0",
    ISC: "ISC",
    CC0: "CC0",
    "CC-BY-4.0": "CC-BY-4.0",
    "CC-BY-SA-4.0": "CC-BY-SA-4.0",
    UNLICENSE: "Unlicense",
  };

  return mappings[normalized] || license;
}

/**
 * Check if two licenses are compatible
 */
function checkLicenseCompatibility(license1, license2) {
  const l1 = normalizeLicense(license1);
  const l2 = normalizeLicense(license2);

  if (!l1 || !l2) return false;

  // Check if license1 allows license2
  const compatible1 = LICENSE_COMPATIBILITY[l1];
  if (compatible1 && compatible1.includes(l2)) {
    return true;
  }

  // Check if license2 allows license1
  const compatible2 = LICENSE_COMPATIBILITY[l2];
  if (compatible2 && compatible2.includes(l1)) {
    return true;
  }

  // Check if they're the same
  if (l1 === l2) {
    return true;
  }

  return false;
}

export default router;
