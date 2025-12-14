const { schema } = require('../models/User');
const ApiError = require('../utils/ApiError');

// const validate = (schema) => {
//   return (req, res, next) => {
//     const { error } = schema.validate(req.body, { abortEarly: false });

//     if (error) {
//       const message = error.details.map((detail) => detail.message).join(', ');
//       throw new ApiError(400, message);
//     }

//     next();
//   };
// };

const validate = (schema) => {
  return (req,res,next) => {
    const {error} = schema.validate(req.body, {abortEarly:false});

    console.log(error)
    if (error){
      const message = error.details.map((detail)=> detail.message).join(', ');
      console.log(message)
      throw new ApiError(400, message)
    }

    next()
    //     {
    //   _original: { email: 'john' },
    //   details: [
    //     {
    //       message: 'Please provide valid email',
    //       path: [Array],
    //       type: 'string.email',
    //       context: [Object]
    //     },
    //     {
    //       message: '"password" is required',
    //       path: [Array],
    //       type: 'any.required',
    //       context: [Object]
    //     }
    //   ]
    // }
  }
}
module.exports = validate;
