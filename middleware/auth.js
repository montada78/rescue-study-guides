const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    req.session.redirectTo = req.originalUrl;
    req.session.error = 'Please log in to access this page';
    return res.redirect('/auth/login');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('error', { 
      title: 'Access Denied', 
      message: 'You do not have permission to access this area.' 
    });
  }
  next();
};

module.exports = { requireAuth, requireAdmin };
