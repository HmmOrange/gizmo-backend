import jwt from "jsonwebtoken";

export const authUser = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "missing_token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "invalid_token" });
  }
}

export const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    req.user = null;
    return next();
  }

  const token = header.split(" ")[1];
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
  } catch (err) {
    req.user = null;
  }

  next();
};

