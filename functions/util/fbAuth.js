const { admin, db } = require('./admin');
module.exports = (req, res, next) => {
  let token;
  if (
    req.header('Authorization') &&
    req.header('Authorization').startsWith('Bearer')
  ) {
    token = req.header('Authorization').split('Bearer ')[1];
  } else {
    return res.sendStatus(401).json({ error: 'Unauthorized' });
  }
  admin
    .auth()
    .verifyIdToken(token)
    .then(decodedToken => {
      return db
        .collection('users')
        .where('userId', '==', decodedToken.uid)
        .limit(1)
        .get();
    })
    .then(data => {
      req.username = data.docs[0].data().username;
      req.userImage = data.docs[0].data().profileImage;
      return next();
    })
    .catch(err => {
      console.error('Error while verifying token', err);
      return res.status(403).json(err);
    });
};
