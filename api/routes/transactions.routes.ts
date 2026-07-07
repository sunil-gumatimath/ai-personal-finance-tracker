import { getAuthedUserId } from "../services/auth.service.js";
import type { ApiRequest, ApiResponse } from "../utils/types.js";
import {
  createUserTransaction,
  deleteUserTransaction,
  listUserTransactions,
  updateUserTransaction,
} from "../services/transactions.service.js";
import { sendApiError } from "../utils/respond.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = req.query?.id;

  if (id && typeof id === "string") {
    if (req.method === "PUT") {
      try {
        const transaction = await updateUserTransaction(req, userId, id, req.body || {});
        res.status(200).json({ transaction });
      } catch (error) {
        console.error("Transactions PUT error:", error);
        sendApiError(res, error);
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        await deleteUserTransaction(req, userId, id);
        res.status(200).json({ ok: true });
      } catch (error) {
        console.error("Transactions DELETE error:", error);
        sendApiError(res, error);
      }
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (req.method === "GET") {
    try {
      const transactions = await listUserTransactions(userId, req.query);
      res.status(200).json({ transactions });
    } catch (error) {
      console.error("Transactions GET error:", error);
      sendApiError(res, error);
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const transaction = await createUserTransaction(req, userId, req.body || {});
      res.status(201).json({ transaction });
    } catch (error) {
      console.error("Transactions POST error:", error);
      sendApiError(res, error);
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
