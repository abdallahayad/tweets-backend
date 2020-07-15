exports.validateSignupData = userData => {
  const errors = {};
  if (isEmpty(userData.email)) errors.email = 'Must not be empty';
  if (isEmpty(userData.password)) errors.password = 'Must not be empty';
  if (userData.password !== userData.confirmPassword)
    errors.confirmPassword = "Passwords doesn't match";
  if (isEmpty(userData.username)) errors.username = 'Must not be empty';
  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false
  };
};
exports.validateLoginData = userData => {
  const errors = {};
  if (isEmpty(userData.email)) errors.email = 'Must not be empty';
  if (isEmpty(userData.password)) errors.password = 'Must not be empty';
  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false
  };
};
exports.validateComment = comment => {
  const errors = {};
  if (isEmpty(comment)) errors.comment = 'Must not be empty';
  return {
    errors,
    valid: Object.keys(errors).length === 0 ? true : false
  };
};

const isEmpty = str => {
  if (str.trim().length === 0) return true;
};
