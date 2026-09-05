import { isValidSuiAddress, normalizeSuiAddress } from '@mysten/sui/utils';
import { prisma } from '../db';
import { resolveUserId } from '../recipients/store';

export class GuardianError extends Error {}
const validAmount = (v: string) => /^\d+(?:\.\d+)?$/.test(v) && Number(v) > 0;

export async function listGuardians(owner: string) {
  const userId = await resolveUserId(owner);
  const [guardians, policy] = await Promise.all([prisma.guardian.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }), prisma.approvalPolicy.findUnique({ where: { userId } })]);
  return { guardians: guardians.map(g => ({ id: g.id, name: g.name, address: g.address })), policy: { thresholdUsdc: policy?.thresholdUsdc?.toString() ?? '', thresholdSui: policy?.thresholdSui?.toString() ?? '', requireNewRecipient: policy?.requireNewRecipient ?? true } };
}

export async function addGuardian(owner: string, name: string, address: string) {
  const userId = await resolveUserId(owner);
  if (!isValidSuiAddress(address)) throw new GuardianError('Enter a valid Sui wallet address');
  const cleanName = name.trim().slice(0, 40) || 'Guardian';
  return prisma.guardian.create({ data: { userId, name: cleanName, address: normalizeSuiAddress(address) } });
}
export async function removeGuardian(owner: string, id: string) { const userId = await resolveUserId(owner); await prisma.guardian.deleteMany({ where: { id, userId } }); }
export async function savePolicy(owner: string, usdc: string, sui: string, requireNewRecipient: boolean) {
  const userId = await resolveUserId(owner);
  if (usdc && !validAmount(usdc) || sui && !validAmount(sui)) throw new GuardianError('Thresholds must be positive amounts');
  return prisma.approvalPolicy.upsert({ where: { userId }, create: { userId, thresholdUsdc: usdc || null, thresholdSui: sui || null, requireNewRecipient }, update: { thresholdUsdc: usdc || null, thresholdSui: sui || null, requireNewRecipient } });
}
export async function listApprovalRequests(guardianAddress: string) {
  const address = normalizeSuiAddress(guardianAddress);
  await prisma.approvalRequest.updateMany({ where: { status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
  const rows = await prisma.approvalRequest.findMany({ where: { guardian: { address } }, include: { guardian: true }, orderBy: { createdAt: 'desc' } });
  return rows.map(r => ({ id: r.id, amount: r.amount.toString(), asset: r.asset, recipient: r.recipient, reason: r.reason, status: r.status, expiresAt: r.expiresAt.toISOString(), owner: r.guardian.name }));
}
export async function decideRequest(guardianAddress: string, id: string, approve: boolean) {
  const address = normalizeSuiAddress(guardianAddress);
  const request = await prisma.approvalRequest.findFirst({ where: { id, guardian: { address }, status: 'PENDING', expiresAt: { gt: new Date() } } });
  if (!request) throw new GuardianError('Approval request is no longer pending');
  return prisma.approvalRequest.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED' } });
}

export async function approvalGate(input: { owner: string; recipient: string; amount: string; asset: string; reason: string | null }) {
  const userId = await resolveUserId(input.owner);
  const recipient = normalizeSuiAddress(input.recipient);
  const policy = await prisma.approvalPolicy.findUnique({ where: { userId } });
  const guardians = await prisma.guardian.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  if (!policy || guardians.length === 0) return { required: false as const };
  const knownRecipient = await prisma.recipient.findFirst({ where: { userId, address: recipient } });
  const threshold = input.asset === 'USDC' ? policy.thresholdUsdc : policy.thresholdSui;
  const exceedsThreshold = threshold !== null && threshold !== undefined && Number(input.amount) > Number(threshold);
  const requiresApproval = exceedsThreshold || (policy.requireNewRecipient && !knownRecipient);
  if (!requiresApproval) return { required: false as const };
  await prisma.approvalRequest.updateMany({ where: { userId, status: 'PENDING', expiresAt: { lt: new Date() } }, data: { status: 'EXPIRED' } });
  const existing = await prisma.approvalRequest.findFirst({ where: { userId, recipient, amount: input.amount, asset: input.asset, status: { in: ['PENDING', 'APPROVED'] } }, orderBy: { createdAt: 'desc' } });
  if (existing?.status === 'APPROVED') return { required: false as const, approved: true };
  const request = existing ?? await prisma.approvalRequest.create({ data: { userId, guardianId: guardians[0].id, recipient, amount: input.amount, asset: input.asset, reason: input.reason?.slice(0, 500) || null, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
  return { required: true as const, requestId: request.id, status: request.status, expiresAt: request.expiresAt.toISOString() };
}
