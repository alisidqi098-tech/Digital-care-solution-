# Auth Testing Playbook — Digital Care AI

## Step 1: MongoDB Verification
```
mongosh
use test_database
db.users.find({role: "admin"}).pretty()
db.users.findOne({role: "admin"}, {password_hash: 1})
```
Verify: bcrypt hash starts with `$2b$`, unique index on users.email, index on login_attempts.identifier.

## Step 2: API Testing
```
curl -c cookies.txt -X POST $API/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@digitalcare.ai","password":"Admin2026!"}'
curl -b cookies.txt $API/api/auth/me
```
Login returns {access_token, user} and sets access_token + refresh_token cookies. /me returns the same user.

## Step 3: Role checks
- Clinic token on /api/admin/overview → 403
- Admin token on /api/dashboard → 403
- No token → 401
