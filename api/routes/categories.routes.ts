import { getAuthedUserId } from "../services/auth.service.js";
import type { ApiRequest, ApiResponse } from "../utils/types.js";
import {
  createUserCategory,
  deleteUserCategory,
  listUserCategories,
  updateUserCategory,
} from "../services/categories.service.js";
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
        const category = await updateUserCategory(userId, id, req.body || {});
        res.status(200).json({ category });
      } catch (error) {
        console.error("Categories PUT error:", error);
        sendApiError(res, error);
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        await deleteUserCategory(userId, id);
        res.status(200).json({ ok: true });
      } catch (error) {
        console.error("Categories DELETE error:", error);
        sendApiError(res, error);
      }
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (req.method === "GET") {
    try {
      const categories = await listUserCategories(userId, req.query?.type);
      res.status(200).json({ categories });
    } catch (error) {
      console.error("Categories GET error:", error);
      sendApiError(res, error);
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const category = await createUserCategory(userId, req.body || {});
      res.status(201).json({ category });
    } catch (error) {
      console.error("Categories POST error:", error);
      sendApiError(res, error);
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
