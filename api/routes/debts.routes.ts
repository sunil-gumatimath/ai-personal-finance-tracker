import { getAuthedUserId } from "../services/auth.service.js";
import type { ApiRequest, ApiResponse } from "../utils/types.js";
import {
  createUserDebt,
  createUserDebtPayment,
  deleteUserDebt,
  listUserDebtPayments,
  listUserDebts,
  updateUserDebt,
} from "../services/debts.service.js";
import { sendApiError } from "../utils/respond.js";

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const userId = await getAuthedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.query?.action === "payments") {
    if (req.method === "GET") {
      try {
        const debtId = req.query?.debtId;
        if (!debtId) {
          res.status(400).json({ error: "Missing debtId" });
          return;
        }
        const payments = await listUserDebtPayments(userId, debtId);
        res.status(200).json({ payments });
      } catch (error) {
        console.error("Debt payments GET error:", error);
        sendApiError(res, error);
      }
      return;
    }

    if (req.method === "POST") {
      try {
        const payment = await createUserDebtPayment(userId, req.body || {});
        res.status(201).json({ payment });
      } catch (error) {
        console.error("Debt payments POST error:", error);
        sendApiError(res, error);
      }
      return;
    }
  }

  const id = req.query?.id;
  if (id && typeof id === "string") {
    if (req.method === "PUT") {
      try {
        const debt = await updateUserDebt(userId, id, req.body || {});
        res.status(200).json({ debt });
      } catch (error) {
        console.error("Debts PUT error:", error);
        sendApiError(res, error);
      }
      return;
    }

    if (req.method === "DELETE") {
      try {
        await deleteUserDebt(userId, id);
        res.status(200).json({ ok: true });
      } catch (error) {
        console.error("Debts DELETE error:", error);
        sendApiError(res, error);
      }
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (req.method === "GET") {
    try {
      const debts = await listUserDebts(userId);
      res.status(200).json({ debts });
    } catch (error) {
      console.error("Debts GET error:", error);
      sendApiError(res, error);
    }
    return;
  }

  if (req.method === "POST") {
    try {
      const debt = await createUserDebt(userId, req.body || {});
      res.status(201).json({ debt });
    } catch (error) {
      console.error("Debts POST error:", error);
      sendApiError(res, error);
    }
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
