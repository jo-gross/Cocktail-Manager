import { describe, expect, it, vi } from 'vitest';
import { createLeaveGuard, type LeavePromptActions } from '../leaveGuard';
import type { NavigationIntent } from '@lib/navigation/navigationGuards';

const leavePage: NavigationIntent = { kind: 'pop', url: '/workspaces/w/manage/cocktails', samePage: false };

function setup() {
  let prompt: LeavePromptActions | undefined;
  const showPrompt = vi.fn((actions: LeavePromptActions) => {
    prompt = actions;
  });
  const environment = { prompt: showPrompt, allowNextNavigation: vi.fn(), proceed: vi.fn() };
  const guard = createLeaveGuard(environment);
  guard.setPrompt(showPrompt);
  return { guard, environment, prompt: () => prompt! };
}

describe('leave guard', () => {
  it('does not block while clean', () => {
    const { guard, environment } = setup();
    expect(guard.guard(leavePage)).toBe(false);
    const leave = vi.fn();
    guard.confirmLeave(leave);
    expect(leave).toHaveBeenCalled();
    expect(environment.prompt).not.toHaveBeenCalled();
  });

  it('blocks leaving the page while dirty, but not query/hash changes', () => {
    const { guard, environment } = setup();
    guard.setDirty(true);
    expect(guard.guard({ ...leavePage, samePage: true })).toBe(false);
    expect(guard.guard(leavePage)).toBe(true);
    expect(environment.prompt).toHaveBeenCalledTimes(1);
    expect(guard.isBlocking()).toBe(true);
  });

  it('does not stack a second prompt while one is open', () => {
    const { guard, environment, prompt } = setup();
    guard.setDirty(true);
    guard.guard(leavePage);
    prompt().onOpenChange(true);
    expect(guard.guard(leavePage)).toBe(true);
    expect(environment.prompt).toHaveBeenCalledTimes(1);
    prompt().onOpenChange(false);
    guard.guard(leavePage);
    expect(environment.prompt).toHaveBeenCalledTimes(2);
  });

  it('discard continues the blocked navigation and never prompts again for the same state', () => {
    const { guard, environment, prompt } = setup();
    guard.setDirty(true);
    guard.guard(leavePage);
    prompt().discard();
    expect(environment.allowNextNavigation).toHaveBeenCalled();
    expect(environment.proceed).toHaveBeenCalledWith(leavePage);
    expect(guard.isBlocking()).toBe(false);
    expect(guard.guard(leavePage)).toBe(false);
  });

  it('only offers saving when the page can save', () => {
    const { guard, prompt } = setup();
    guard.setDirty(true);
    guard.guard(leavePage);
    expect(prompt().save).toBeUndefined();
    guard.setOnSave(async () => true);
    guard.guard(leavePage);
    expect(prompt().save).toBeTypeOf('function');
  });

  it('save resolving true continues the blocked navigation', async () => {
    const { guard, environment, prompt } = setup();
    guard.setDirty(true);
    guard.setOnSave(async () => true);
    guard.guard(leavePage);
    await prompt().save!();
    expect(environment.proceed).toHaveBeenCalledWith(leavePage);
    expect(guard.isBlocking()).toBe(false);
  });

  it('a failed save stays on the page and keeps guarding', async () => {
    const { guard, environment, prompt } = setup();
    guard.setDirty(true);
    guard.setOnSave(async () => false);
    guard.guard(leavePage);
    await prompt().save!();
    expect(environment.proceed).not.toHaveBeenCalled();
    expect(guard.isBlocking()).toBe(true);
  });

  it('forms that redirect themselves continue the pending navigation instead of their default redirect', async () => {
    const { guard, environment, prompt } = setup();
    const defaultRedirect = vi.fn();
    guard.setDirty(true);
    // Formik submit: resolves void, the form calls completeSave on success.
    guard.setOnSave(async () => {
      await guard.completeSave(defaultRedirect);
    });
    guard.guard(leavePage);
    await prompt().save!();
    expect(defaultRedirect).not.toHaveBeenCalled();
    expect(environment.proceed).toHaveBeenCalledTimes(1);
    expect(environment.proceed).toHaveBeenCalledWith(leavePage);
  });

  it('completeSave without a pending prompt runs the default redirect unguarded', async () => {
    const { guard, environment } = setup();
    const defaultRedirect = vi.fn();
    guard.setDirty(true);
    await guard.completeSave(defaultRedirect);
    expect(defaultRedirect).toHaveBeenCalled();
    expect(environment.allowNextNavigation).toHaveBeenCalled();
    expect(guard.isBlocking()).toBe(false);
  });

  it('re-arms after a save once the state changes again', () => {
    const { guard } = setup();
    guard.setDirty(true);
    guard.markSaved();
    expect(guard.isBlocking()).toBe(false);
    // Baseline reset after save …
    guard.setDirty(false);
    // … then the user edits again.
    guard.setDirty(true);
    expect(guard.isBlocking()).toBe(true);
  });

  it('confirmLeave prompts while dirty and leaves after discard', () => {
    const { guard, prompt } = setup();
    const leave = vi.fn();
    guard.setDirty(true);
    guard.confirmLeave(leave);
    expect(leave).not.toHaveBeenCalled();
    prompt().discard();
    expect(leave).toHaveBeenCalled();
  });
});
