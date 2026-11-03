---
type: wayfinder-ticket
wayfinder: task
map: 741
status: open
blocked-by: 746, 747, 748
---

# 749 — IT approves the on-prem hosts and service logins for the analytics stack

## Question

Once the pieces are chosen, what must IT and the DBA provide before the build can start?

Hand the owner a precise checklist covering:
- the host or hosts: VM sizing and the container runtime;
- the service logins on the replica, or a sibling database, and their least-privilege grants;
- the network paths: from the BI tool and the semantic layer to the replica, and from SIS.Api to
  the semantic layer;
- the SSO registration for the BI tool;
- whether the model egress stays the one line 734 D9 approved.

Resolved when IT has approved, or has named its conditions. The answer records the hosts, the
login names (never their secrets) and the URLs that the spec relies on.
