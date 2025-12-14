async function response(res,result) {
    return res.status(201).json({
    success: true,
    data: result,
  });
}

module.exports = {
    response
}