import { getAuthedUserId } from "../services/auth.service.js";
import type { ApiRequest, ApiResponse } from "../utils/types.js";
import {
  createUserGoal,
  deleteUserGoal,
  listUserGoals,
  updateUserGoal,
} from "../services/goals.service.js";
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
        const goal = await updateUserGoal(userId, id, req.body || {});
        res.status(200).json({ goal });
      } catch (error) {
        console.error("Goals PUT error:", error);
        sendApiError(res, error);
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        await deleteUserGoal(userId, id);
        res.status(200).json({ ok: true });
      } catch (error) {
        console.error("Goals DELETE error:", error);
        sendApiError(res, error);
      }
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (req.method === "GET") {
    try {
      const goals = await listUserGoals(userId);
      res.status(200).json({ goals });
    } catch (error) {
      console.error("Goals GET error:", error);
      sendApiError(res, error);
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const goal = await createUserGoal(userId, req.body || {});
      res.status(201).json({ goal });
    } catch (error) {
      console.error("Goals POST error:", error);
      sendApiError(res, error);
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
