import express from "express";
import { redirectToMicrosoft, handleMicrosoftCallback } from "../auth/microsoftAuth.js";

const router = express.Router();

router.get("/microsoft", redirectToMicrosoft);
router.get("/microsoft/callback", handleMicrosoftCallback);

export default router;
