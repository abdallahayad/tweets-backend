const { admin, db } = require('../util/admin');
const { validateComment } = require('../util/validators');

// Create a tweet
exports.tweet = (req, res) => {
  const tweet = {
    body: req.body.body,
    username: req.username,
    userImage: req.userImage,
    createdAt: new Date(Date.now()).toISOString(),
    likeCount: 0,
    commentCount: 0,
  };
  db.collection('tweets')
    .add(tweet)
    .then((doc) => {
      return res.json({ ...tweet, tweetId: doc.id });
    });
};

// Like a tweet
exports.likeATweet = (req, res) => {
  const user = req.username;
  const tweetDoc = db.collection('tweets').doc(req.params.tweetId);
  tweetDoc.get().then((doc) => {
    if (!doc.exists) {
      return res.json({ message: "Tweet doesn't exist" });
    } else {
      db.collection('likes')
        .where('username', '==', user)
        .where('tweetId', '==', req.params.tweetId)
        .get()
        .then((data) => {
          if (!data.empty) {
            res.json({ message: 'Tweet already liked' });
          } else {
            const likeDoc = { username: user, tweetId: req.params.tweetId };
            tweetDoc
              .update({ likeCount: admin.firestore.FieldValue.increment(1) })
              .then(() => {
                return db.collection('likes').add(likeDoc);
              })
              .then(() => {
                return res.json({ likeDoc });
              });
          }
        });
    }
  });
};

// Unlike a tweet
exports.unlikeATweet = (req, res) => {
  const user = req.username;
  const tweetDoc = db.collection('tweets').doc(req.params.tweetId);
  tweetDoc.get().then((doc) => {
    if (!doc.exists) {
      return res.json({ message: "Tweet doesn't exist" });
    } else {
      db.collection('likes')
        .where('username', '==', user)
        .where('tweetId', '==', req.params.tweetId)
        .get()
        .then((data) => {
          if (data.empty) {
            res.json({ message: 'The tweet is already not liked' });
          } else {
            tweetDoc
              .update({ likeCount: admin.firestore.FieldValue.increment(-1) })
              .then(() => {
                db.collection('likes')
                  .where('username', '==', user)
                  .where('tweetId', '==', req.params.tweetId)
                  .limit(1)
                  .get()
                  .then((data) => {
                    data.forEach((doc) => {
                      doc.ref.delete().then(() => {
                        return res.json({ tweetId: req.params.tweetId });
                      });
                    });
                  });
              });
          }
        });
    }
  });
};

// Comment on a tweet
exports.commentOnATweet = (req, res) => {
  const comment = {
    body: req.body.body,
    createdAt: new Date(Date.now()).toISOString(),
    username: req.username,
    userImage: req.userImage,
    tweetId: req.params.tweetId,
  };
  const { errors, valid } = validateComment(comment.body);
  if (!valid) return res.json(errors);
  db.collection('tweets')
    .doc(req.params.tweetId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        doc.ref
          .update({
            commentCount: admin.firestore.FieldValue.increment(1),
          })
          .then(() => {
            db.collection('comments')
              .add(comment)
              .then((doc) => {
                return res.json({ ...comment, commentId: doc.id });
              });
          });
      } else {
        return res.json({ message: 'Tweet not found' });
      }
    });
};

// Delete a tweet
exports.deleteATweet = (req, res) => {
  const username = req.username;
  db.collection('tweets')
    .doc(req.params.tweetId)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.json({ message: "This tweet doesn't exist" });
      }
      if (doc.data().username === username) {
        doc.ref.delete();
        return db
          .collection('comments')
          .where('tweetId', '==', req.params.tweetId)
          .get()
          .then((data) => {
            data.docs.forEach((doc) => {
              doc.ref.delete();
            });
            return db
              .collection('likes')
              .where('tweetId', '==', req.params.tweetId)
              .get();
          })
          .then((data) => {
            data.docs.forEach((doc) => {
              doc.ref.delete();
            });
            return res.json({ tweetId: req.params.tweetId });
          });
      } else {
        res.json({ message: "You can't delete this tweet" });
      }
    })
    .catch((err) => {
      return res.json({ message: err.code });
    });
};

// Get tweet comments
exports.getTweetComments = (req, res) => {
  let tweet = {};
  const tweetId = req.params.tweetId;
  db.doc(`/tweets/${tweetId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.json({ error: "Tweet doesn't exist" });
      }
      db.collection('comments')
        .where('tweetId', '==', tweetId)
        .orderBy('createdAt', 'desc')
        .get()
        .then((data) => {
          tweet.comments = [];
          data.docs.forEach((doc) => {
            tweet.comments.push({ ...doc.data(), commentId: doc.id });
          });
          return res.json(tweet);
        })
        .catch((err) => {
          res.status(500).json({ error: err });
        });
    });
};
// Delete a comment
exports.deleteAComment = (req, res) => {
  const username = req.username;
  const tweetId = req.params.tweetId;
  const commentId = req.params.commentId;
  db.doc(`/comments/${commentId}`)
    .get()
    .then((doc) => {
      if (doc.exists && doc.data().username === username) {
        doc.ref.delete();
        db.doc(`/tweets/${tweetId}`)
          .get()
          .then((doc) => {
            doc.ref
              .update({
                commentCount: admin.firestore.FieldValue.increment(-1),
              })
              .then(() => {
                return res.json({ commentId, tweetId });
              });
          });
      }
    })
    .catch((err) => {
      return res.json({ error: err });
    });
};
