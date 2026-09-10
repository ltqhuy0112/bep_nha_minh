#!/usr/bin/env python3
import os, sys
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

service, secret, commit = sys.argv[1:]
hook = os.environ.get(secret)
p = urlparse(hook or "")
if not hook or p.scheme != "https" or p.hostname != "api.render.com" or p.port not in (None, 443) or not p.path.startswith("/deploy/"):
    raise SystemExit("Invalid Render deploy hook configuration.")
query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k != "ref"]
if not any(k == "key" and v for k, v in query): raise SystemExit("Invalid Render deploy hook configuration.")
target = urlunparse(p._replace(query=urlencode([*query, ("ref", commit)])))
with urlopen(Request(target, method="POST", data=b""), timeout=30) as response:
    if response.status not in (200, 202): raise SystemExit(f"Render rejected {service}: HTTP {response.status}")
print(f"Render accepted the {service} deploy request.")
