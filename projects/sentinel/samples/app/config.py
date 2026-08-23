"""Deliberately insecure fixture — see samples/README.md. Do not copy this file.

Every value here is fake and exists so `sentinel secrets` has something to find.
"""

DEBUG = True

# Hardcoded credential: should come from the environment.
DATABASE_URL = "postgresql://appuser:s3cr3t-db-p4ssw0rd@db.internal:5432/production"

# Hardcoded API key: should come from a secret manager.
api_key = "9f2c41ab77de4c0e8b31a6d5e0f77b21"

# Session signing secret committed to source control.
SECRET_KEY = "k7Qx2pLm9Wz4Rt6Yv8Bn1Cd3Fg5Hj0K"

# A service token pasted in during debugging and never removed.
SERVICE_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdmMtcmVwb3J0aW5nIn0.9NkQm2Xr7pLd4Vb8Tc1Ay6Fw3Zs0Hg5Jk"

# Values below are placeholders, and the scanner should stay quiet about them.
STRIPE_KEY = "<your-stripe-key>"
ADMIN_PASSWORD = "changeme"
SMTP_TOKEN = "${SMTP_TOKEN}"
