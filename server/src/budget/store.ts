import { prisma } from '../db';
import { resolveUserId } from '../recipients/store';

export class BudgetPlanError extends Error {}
const positiveOrZero = (value: string) => /^\d+(?:\.\d+)?$/.test(value) && Number(value) >= 0;
const signedAmount = (value: string) => /^-?\d+(?:\.\d+)?$/.test(value);

export async function saveBudgetPlan(input: Record<string, string>) {
  const userId = await resolveUserId(input.owner);
  const nonNegativeAmounts = ['income', 'essentials', 'savings', 'monthlySupport'];
  if (!nonNegativeAmounts.every(key => positiveOrZero(input[key] ?? '')) || !signedAmount(input.remaining ?? '') || !['USDC', 'SUI'].includes(input.asset) || !['Comfortable', 'Tight', 'Over Budget'].includes(input.result)) throw new BudgetPlanError('Invalid budget-plan values');
  return prisma.budgetPlan.create({ data: { userId, recipientName: input.recipientName, recipientAddress: input.recipientAddress, income: input.income, essentials: input.essentials, savings: input.savings, monthlySupport: input.monthlySupport, remaining: input.remaining, asset: input.asset, frequency: input.frequency, result: input.result, explanation: input.explanation } });
}
export async function listBudgetPlans(owner: string) {
  const userId = await resolveUserId(owner);
  const rows = await prisma.budgetPlan.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 });
  return rows.map(row => ({ id: row.id, recipientName: row.recipientName, income: row.income.toString(), essentials: row.essentials.toString(), savings: row.savings.toString(), monthlySupport: row.monthlySupport.toString(), remaining: row.remaining.toString(), asset: row.asset, frequency: row.frequency, result: row.result, explanation: row.explanation, createdAt: row.createdAt.toISOString() }));
}
