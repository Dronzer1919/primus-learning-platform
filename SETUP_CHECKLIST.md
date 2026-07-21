# Learning Platform - Setup Checklist

## ✅ Setup Checklist

### Prerequisites
- [ ] Node.js installed (v14+)
- [ ] MongoDB installed
- [ ] VS Code or your preferred IDE

---

## Backend Setup

### Installation
- [ ] Navigate to `backend` folder
- [ ] Run `npm install`
- [ ] Verify `.env` file exists with correct settings

### Database
- [ ] Start MongoDB service
- [ ] Run `npm run seed` to populate sample data
- [ ] Verify seed completed successfully

### Start Backend
- [ ] Run `npm run dev`
- [ ] Verify server starts on port 3000
- [ ] Test health endpoint: http://localhost:3000/api/health
- [ ] Should see: `{"success": true, "message": "Learning Platform API is running"}`

---

## Frontend Setup

### Installation
- [ ] Navigate to `learning-platform` folder
- [ ] Run `npm install` (if not already done)
- [ ] Verify environment files exist in `src/environments/`

### Configuration Check
- [ ] Open `src/environments/environment.ts`
- [ ] Verify `apiUrl: 'http://localhost:3000/api'`

### Start Frontend
- [ ] Run `ionic serve`
- [ ] Verify app opens at http://localhost:4200
- [ ] No console errors

---

## Testing

### Login Test
- [ ] Open app at http://localhost:4200
- [ ] Click "Login"
- [ ] Try admin credentials:
  - Username: `admin`
  - Password: `admin123`
- [ ] Should successfully log in

### User View Test
- [ ] After login, you should see user dashboard
- [ ] Language tabs visible at top (HTML, CSS, JavaScript, etc.)
- [ ] Sidebar shows topics grouped by difficulty
- [ ] Click on a topic to expand subtopics
- [ ] Click on a subtopic
- [ ] **Content should now be visible!** ✅

### Admin View Test
- [ ] Logout and login as admin
- [ ] Navigate to admin panel
- [ ] Can manage language tabs
- [ ] Can manage topics
- [ ] Can add/edit/delete content

---

## Verification Steps

### Backend Verification
```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test topics endpoint
curl http://localhost:3000/api/topics

# Expected: JSON response with topics array
```

### Frontend Verification
- [ ] No console errors in browser
- [ ] Network tab shows successful API calls (200 status)
- [ ] Topics load in sidebar
- [ ] Content displays when clicking topics
- [ ] Can navigate between topics

---

## Common Setup Issues

### ❌ MongoDB not running
**Fix:** Start MongoDB service or run `mongod` command

### ❌ Port 3000 in use
**Fix:** Change PORT in backend `.env` file

### ❌ CORS errors
**Fix:** Ensure backend is running before starting frontend

### ❌ Token errors
**Fix:** Clear browser localStorage and login again

### ❌ No content showing
**Fix:** 
1. Verify backend is running
2. Check browser console for API errors
3. Verify seed script ran successfully
4. Check MongoDB has data: `use learning-platform` then `db.topics.find()`

---

## Quick Commands Reference

### Backend
```bash
cd backend
npm install          # Install dependencies
npm run seed        # Seed database
npm run dev         # Start development server
npm start           # Start production server
```

### Frontend
```bash
cd learning-platform
npm install         # Install dependencies
ionic serve         # Start development server
ionic build --prod  # Build for production
```

### MongoDB
```bash
mongod              # Start MongoDB
mongo               # Open MongoDB shell
use learning-platform   # Switch to app database
db.topics.find()    # View topics
db.users.find()     # View users
```

---

## Success Criteria

You'll know everything is working when:

✅ Backend server running without errors
✅ MongoDB connected successfully
✅ Frontend app loads without console errors
✅ Can login with test credentials
✅ Topics appear in sidebar
✅ **Clicking a topic shows content** ← Main issue fixed!
✅ Can navigate between topics smoothly
✅ Admin can manage content

---

## Next Steps After Setup

1. [ ] Explore the existing sample topics
2. [ ] Login as admin and add your own topics
3. [ ] Test all CRUD operations
4. [ ] Try the notes feature
5. [ ] Explore the code playground
6. [ ] Customize the styling if needed
7. [ ] Add more topics and content

---

## Getting Help

If you're stuck:

1. Check [BACKEND_SETUP.md](BACKEND_SETUP.md) for detailed instructions
2. Review [API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md) for API details
3. Check [BACKEND_SUMMARY.md](BACKEND_SUMMARY.md) for implementation overview
4. Review [README_COMPLETE.md](README_COMPLETE.md) for full documentation

---

## Important Files

| File | Purpose |
|------|---------|
| `backend/.env` | Backend configuration |
| `backend/seed.js` | Sample data generator |
| `backend/src/server.js` | Main backend server |
| `learning-platform/src/environments/environment.ts` | Frontend API config |
| `learning-platform/src/app/services/content.service.ts` | Content API service |
| `learning-platform/src/app/interceptors/auth.interceptor.ts` | JWT token handler |

---

**Current Status:** All backend APIs created, frontend integrated, issue resolved! ✅

**Test Credentials:**
- Admin: `admin` / `admin123`
- User: `testuser` / `user123`

Ready to go! 🚀
