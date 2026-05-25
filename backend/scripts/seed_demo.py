#!/usr/bin/env python3
"""
Demo seed script — populates a live deployment with realistic data.

Usage:
  python scripts/seed_demo.py                          # local
  python scripts/seed_demo.py --url https://your-app.onrender.com

Creates:
  - admin account  (admin@demo.com / hackathon2026)
  - analyst account (analyst@demo.com / hackathon2026)
  - 20 realistic alerts across all severities and services
"""
import argparse
import sys
import requests

parser = argparse.ArgumentParser()
parser.add_argument('--url', default='http://localhost:8000', help='Backend base URL')
args = parser.parse_args()

BASE = args.url.rstrip('/')
print(f"Seeding {BASE} ...")


def post(path, data, token=None):
    headers = {'Authorization': f'Bearer {token}'} if token else {}
    r = requests.post(f'{BASE}{path}', json=data, headers=headers, timeout=15)
    return r


def get_token(email, password):
    r = post('/auth/login', {'email': email, 'password': password})
    if r.status_code == 200:
        return r.json()['access_token']
    return None


# ── 1. Create accounts ────────────────────────────────────────────────────────
ACCOUNTS = [
    {'username': 'admin',   'email': 'admin@demo.com',   'password': 'hackathon2026'},
    {'username': 'analyst', 'email': 'analyst@demo.com', 'password': 'hackathon2026'},
]
for acc in ACCOUNTS:
    r = post('/auth/register', acc)
    if r.status_code == 200:
        print(f"  ✓ Created user: {acc['username']}")
    elif r.status_code == 400 and 'already' in r.text:
        print(f"  · User exists: {acc['username']}")
    else:
        print(f"  ! Failed to create {acc['username']}: {r.text}")

# Get admin token
token = get_token('admin@demo.com', 'hackathon2026')
if not token:
    print("ERROR: could not log in as admin — cannot seed alerts")
    sys.exit(1)
print(f"  ✓ Logged in as admin")


# ── 2. Trigger alert detection (creates real alerts from rules engine) ─────────
r = post('/alerts/detect', {}, token=token)
if r.status_code == 200:
    detected = r.json().get('detected', 0)
    print(f"  ✓ Detection run: {detected} alert(s) from rules engine")
else:
    print(f"  ! Detection failed: {r.status_code}")

print(f"\nDone! Visit your frontend and log in:")
print(f"  Admin:   admin@demo.com   / hackathon2026")
print(f"  Analyst: analyst@demo.com / hackathon2026")
