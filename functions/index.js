const app = require('express')();
const functions = require('firebase-functions');
const cors = require('cors');
const { db } = require('./util/admin');
const FBAuth = require('./util/fbAuth');
const {
  signup,
  login,
  follow,
  addBio,
  getAuthenticatedUser,
  getUser,
  uploadProfileImage,
  refreshToken,
  searchUsers,
} = require('./routes/user');
const {
  tweet,
  likeATweet,
  unlikeATweet,
  commentOnATweet,
  deleteATweet,
  deleteAComment,
  getFullTweet,
} = require('./routes/tweets');

app.use(cors());

// User Routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/refreshtoken', refreshToken);
app.get('/:user/follow', FBAuth, follow);
app.post('/user/bio', FBAuth, addBio);
app.get('/user', FBAuth, getAuthenticatedUser);
app.post('/user/profilepic', FBAuth, uploadProfileImage);
app.get('/user/:username', getUser);
app.post('/users', searchUsers);

// Tweet Routes
app.post('/tweet/add', FBAuth, tweet);
app.get('/tweet/:tweetId', getFullTweet);
app.get('/tweet/:tweetId/like', FBAuth, likeATweet);
app.get('/tweet/:tweetId/unlike', FBAuth, unlikeATweet);
app.post('/tweet/:tweetId/comment', FBAuth, commentOnATweet);
app.delete('/tweet/:tweetId/:commentId', FBAuth, deleteAComment);
app.delete('/tweet/:tweetId', FBAuth, deleteATweet);

exports.api = functions.https.onRequest(app);

exports.onUserImageChange = functions.firestore
  .document('/users/{userId}')
  .onUpdate((change) => {
    if (
      change.before.data().profileImage !== change.after.data().profileImage
    ) {
      db.collection('tweets')
        .where('username', '==', change.before.data().username)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const tweet = db.doc(`/tweets/${doc.id}`);
            tweet.update({
              userImage: change.after.data().profileImage,
            });
          });
          return db
            .collection('comments')
            .where('username', '==', change.before.data().username)
            .get();
        })
        .then((data) => {
          data.forEach((doc) => {
            const comment = db.doc(`/comments/${doc.id}`);
            comment.update({
              userImage: change.after.data().profileImage,
            });
          });
        });
    }
  });
