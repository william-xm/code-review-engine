import express, { Router } from "express";
import { requestUrl, requestBody } from "../middleware/index";

const router: Router = express.Router();

/* GET home page. */
router.get('/', requestUrl, requestBody, (req, res, next) => {
  res.json({
    code: 200,
    message: 'success',
    data: null
  })
});

router.post('/', requestUrl, requestBody, (req, res, next) => {
  res.json({
    code: 200,
    message: 'success',
    data: null
  })
});

export default router;
