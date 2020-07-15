const firebase = require('firebase');
const { validateSignupData, validateLoginData } = require('../util/validators');
const { admin, db } = require('../util/admin');
const path = require('path');
const axios = require('axios');
const firebaseConfig = require('../firebaseConfig');
firebase.initializeApp(firebaseConfig);

exports.signup = (req, res) => {
  const userData = {
    email: req.body.email,
    password: req.body.password,
    confirmPassword: req.body.confirmPassword,
    username: req.body.username,
  };
  const { errors, valid } = validateSignupData(userData);
  if (!valid) return res.status(400).json(errors);
  db.collection('users')
    .doc(userData.username)
    .get()
    .then((doc) => {
      if (doc.exists) {
        return res
          .status(400)
          .json({ username: 'This user name already exists' });
      } else {
        let token, userId, refreshToken;
        firebase
          .auth()
          .createUserWithEmailAndPassword(userData.email, userData.password)
          .then((data) => {
            userId = data.user.uid;
            refreshToken = data.user.refreshToken;
            return data.user.getIdToken();
          })
          .then((idToken) => {
            token = idToken;
            const newUser = {
              email: userData.email,
              username: userData.username,
              userId: userId,
              createdAt: new Date().toISOString(),
              profileImage: `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/no-img.png?alt=media`,
              following: [],
            };
            return db.doc(`users/${userData.username}`).set(newUser);
          })
          .then(() => {
            res.json({ token, refreshToken: refreshToken });
          })
          .catch((err) => {
            if (err.code === 'auth/email-already-in-use')
              return res
                .status(400)
                .json({ email: 'This email is already registered' });
            res.json({ error: err.code });
          });
      }
    });
};

exports.login = (req, res) => {
  const userData = {
    email: req.body.email,
    password: req.body.password,
  };
  const { errors, valid } = validateLoginData(userData);
  let refreshToken;
  if (!valid) return res.status(400).json(errors);
  firebase
    .auth()
    .signInWithEmailAndPassword(userData.email, userData.password)
    .then((data) => {
      refreshToken = data.user.refreshToken;
      return data.user.getIdToken();
    })
    .then((idToken) => {
      res.json({ token: idToken, refreshToken: refreshToken });
    })
    .catch((err) => {
      res.status(400).json({ error: 'Wrong credentials, please try again' });
    });
};

exports.follow = (req, res) => {
  db.collection('users')
    .doc(req.username)
    .update({
      following: admin.firestore.FieldValue.arrayUnion(req.params.user),
    });
  return res.json({ message: `You are now following @${req.params.user}` });
};

exports.addBio = (req, res) => {
  const bioData = {};
  if (req.body.location) bioData.location = req.body.location;
  if (req.body.birthDate) bioData.birthDate = req.body.birthDate;
  if (req.body.job) bioData.job = req.body.job;
  db.collection('users')
    .doc(req.username)
    .update({ ...bioData })
    .then(() => {
      res.json(bioData);
    })
    .catch((err) => {
      res.status(500).json({ error: err.code });
    });
};

// Logged in user data
exports.getAuthenticatedUser = (req, res) => {
  let userData = {};
  db.collection('users')
    .doc(req.username)
    .get()
    .then((doc) => {
      userData.credentials = doc.data();
      userData.tweets = [];
      let promises = [
        db.collection('tweets').where('username', '==', req.username).get(),
      ];
      userData.credentials.following.forEach((follow) => {
        promises.push(
          db.collection('tweets').where('username', '==', follow).get()
        );
      });
      Promise.all(promises)
        .then((data) => {
          data.forEach((docs) => {
            docs.forEach((doc) => {
              const tweet = { ...doc.data(), tweetId: doc.id };
              userData.tweets.push(tweet);
            });
          });
          return db
            .collection('likes')
            .where('username', '==', req.username)
            .get();
        })
        .then((data) => {
          userData.likes = [];
          data.docs.forEach((doc) => {
            userData.likes.push(doc.data());
          });
          return res.json(userData);
        })
        .catch((err) => {
          res.status(500).json({ error: err.code });
        });
    });
};

// Get any user data
exports.getUser = (req, res) => {
  let userData = {};
  const username = req.params.username;
  db.doc(`/users/${username}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        userData.credentials = doc.data();
        return db.collection('tweets').where('username', '==', username).get();
      }
    })
    .then((data) => {
      userData.tweets = [];
      data.docs.forEach((doc) => {
        const tweet = { ...doc.data(), tweetId: doc.id };
        userData.tweets.push(tweet);
      });
      return res.json(userData);
    });
};

// Upload user profile image
exports.uploadProfileImage = (req, res) => {
  const BusBoy = require('busboy');
  const path = require('path');
  const os = require('os');
  const fs = require('fs');

  const busboy = new BusBoy({ headers: req.headers });
  let imageFileName;
  let imageToBeUploaded = {};

  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      return res.status(400).json({ error: 'Wrong file type submitted' });
    }
    const imageExtension = filename.split('.')[filename.split('.').length - 1];
    imageFileName = `${Math.round(
      Math.random() * 1000000000000
    )}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });
  busboy.on('finish', () => {
    let imageUrl;
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          contentType: imageToBeUploaded.mimetype,
        },
      })
      .then(() => {
        imageUrl = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${imageFileName}?alt=media`;
        return db
          .doc(`/users/${req.username}`)
          .update({ profileImage: imageUrl });
      })
      .then(() => {
        return res.json({ profileImage: imageUrl });
      })
      .catch((err) => {
        return res.status(500).json({ error: err.code });
      });
  });
  busboy.end(req.rawBody);
};

exports.refreshToken = (req, res) => {
  const refreshToken = req.body.refresh_token;
  axios({
    method: 'post',
    url: `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`,
    data: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    headers: { 'Content-Type': 'application / x-www-form-urlencoded' },
  })
    .then((result) => {
      return res.json(result.data);
    })
    .catch((err) => res.json(err));
};

exports.searchUsers = (req, res) => {
  const username = req.body.username;
  let user = {};
  db.doc(`/users/${username}`)
    .get()
    .then((doc) => {
      if (doc.exists) {
        user.username = doc.data().username;
        user.profileImage = doc.data().profileImage;
        return res.json(user);
      }
    })
    .catch((err) => {
      return res.json(err);
    });
};
