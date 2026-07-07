import { getAuthedUserId } from "../services/auth.service.js";
import type { ApiRequest, ApiResponse } from "../utils/types.js";
import {
  createUserBudget,
  deleteUserBudget,
  listUserBudgets,
  updateUserBudget,
} from "../services/budgets.service.js";
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
        const budget = await updateUserBudget(userId, id, req.body || {});
        res.status(200).json({ budget });
      } catch (error) {
        console.error("Budgets PUT error:", error);
        sendApiError(res, error);
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        await deleteUserBudget(userId, id);
        res.status(200).json({ ok: true });
      } catch (error) {
        console.error("Budgets DELETE error:", error);
        sendApiError(res, error);
      }
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (req.method === "GET") {
    try {
      const budgets = await listUserBudgets(userId);
      res.status(200).json({ budgets });
    } catch (error) {
      console.error("Budgets GET error:", error);
      sendApiError(res, error);
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const budget = await createUserBudget(userId, req.body || {});
      res.status(201).json({ budget });
    } catch (error) {
      console.error("Budgets POST error:", error);
      sendApiError(res, error);
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
