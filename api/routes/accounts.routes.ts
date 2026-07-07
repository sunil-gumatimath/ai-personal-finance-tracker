import { getAuthedUserId } from "../services/auth.service.js";
import type { ApiRequest, ApiResponse } from "../utils/types.js";
import {
  createUserAccount,
  deleteUserAccount,
  getLinkedTransactionCount,
  listUserAccounts,
  updateUserAccount,
} from "../services/accounts.service.js";
import { sendApiError } from "../utils/respond.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.query?.action === "linked-count") {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const accountId = req.query.accountId;
      if (!accountId) {
        res.status(400).json({ error: "Missing accountId" });
        return;
      }
      const count = await getLinkedTransactionCount(userId, accountId);
      res.status(200).json({ count });
    } catch (error) {
      console.error("Accounts linked-count error:", error);
      sendApiError(res, error);
    }
    return;
  }

  const id = req.query?.id;
  if (id && typeof id === "string") {
    if (req.method === "PUT") {
      try {
        const account = await updateUserAccount(req, userId, id, req.body || {});
        res.status(200).json({ account });
      } catch (error) {
        console.error("Accounts PUT error:", error);
        sendApiError(res, error);
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        await deleteUserAccount(req, userId, id, req.query?.cascade === "1");
        res.status(200).json({ ok: true });
      } catch (error) {
        console.error("Accounts DELETE error:", error);
        sendApiError(res, error);
      }
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (req.method === "GET") {
    try {
      const accounts = await listUserAccounts(userId);
      res.status(200).json({ accounts });
    } catch (error) {
      console.error("Accounts GET error:", error);
      sendApiError(res, error);
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const account = await createUserAccount(req, userId, req.body || {});
      res.status(201).json({ account });
    } catch (error) {
      console.error("Accounts POST error:", error);
      sendApiError(res, error);
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
