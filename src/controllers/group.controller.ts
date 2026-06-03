import { Response } from "express";
import { AuthRequest } from "../types";
import { sendSuccess } from "../utils/response";
import * as groupService from "../services/group.service";

export const groupController = {
  async getGroup(req: AuthRequest, res: Response) {
    const group = await groupService.getGroup(
      String(String(req.params.chatId)),
      req.user!.id
    );
    sendSuccess(res, group);
  },

  async updateGroup(req: AuthRequest, res: Response) {
    const group = await groupService.updateGroup(
      String(String(req.params.chatId)),
      req.user!.id,
      req.body
    );
    sendSuccess(res, group, "Group updated");
  },

  async addMembers(req: AuthRequest, res: Response) {
    await groupService.addMembers(
      String(String(req.params.chatId)),
      req.user!.id,
      req.body.userIds
    );
    sendSuccess(res, null, "Members added");
  },

  async removeMember(req: AuthRequest, res: Response) {
    await groupService.removeMember(
      String(String(req.params.chatId)),
      req.user!.id,
      String(String(req.params.userId))
    );
    sendSuccess(res, null, "Member removed");
  },

  async updateMemberRole(req: AuthRequest, res: Response) {
    await groupService.updateMemberRole(
      String(String(req.params.chatId)),
      req.user!.id,
      String(String(req.params.userId)),
      req.body.role
    );
    sendSuccess(res, null, "Role updated");
  },

  async generateInvite(req: AuthRequest, res: Response) {
    const group = await groupService.generateInviteCode(
      String(String(req.params.chatId)),
      req.user!.id
    );
    sendSuccess(res, { inviteCode: group.inviteCode });
  },

  async joinByInvite(req: AuthRequest, res: Response) {
    const group = await groupService.joinByInviteCode(
      String(String(req.params.code)),
      req.user!.id
    );
    sendSuccess(res, group, "Joined group");
  },
};