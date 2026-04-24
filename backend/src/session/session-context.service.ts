import { Injectable } from '@nestjs/common';

export interface ITeamInfo {
  _id: string;
  name: string;
  companyId: string;
}

@Injectable()
export class SessionContextService {
  private _teamId: string | null = null;
  private _teamName: string | null = null;
  private _pendingTeamSelection = false;
  /** Raw teams list cached after first API fetch */
  private _availableTeams: ITeamInfo[] = [];

  /**
   * The original user message + intent saved BEFORE entering team selection.
   * After the user picks a team we replay this to avoid asking "what do you want?" again.
   */
  pendingIntent: { intent: string; message: string } | null = null;

  // ── Getters ──────────────────────────────────────────────────────────────────

  get teamId(): string | null {
    return this._teamId;
  }

  get teamName(): string | null {
    return this._teamName;
  }

  get pendingTeamSelection(): boolean {
    return this._pendingTeamSelection;
  }

  get availableTeams(): ITeamInfo[] {
    return this._availableTeams;
  }

  // ── Setters ──────────────────────────────────────────────────────────────────

  setTeam(id: string, name: string): void {
    this._teamId = id;
    this._teamName = name;
    this._pendingTeamSelection = false;
  }

  setAvailableTeams(teams: ITeamInfo[]): void {
    this._availableTeams = teams;
  }

  setPendingSelection(value: boolean): void {
    this._pendingTeamSelection = value;
  }

  resetTeam(): void {
    this._teamId = null;
    this._teamName = null;
    this._pendingTeamSelection = false;
    this.pendingIntent = null;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  hasTeam(): boolean {
    return !!this._teamId;
  }

  /**
   * Resolve team from user input.
   * Accepts: number string "1"/"2"/... or partial team name.
   * Returns the matched team or null if not found.
   */
  resolveTeamFromInput(input: string): ITeamInfo | null {
    const trimmed = input.trim();

    // Try numeric index (1-based)
    const idx = parseInt(trimmed, 10);
    if (!isNaN(idx) && idx >= 1 && idx <= this._availableTeams.length) {
      return this._availableTeams[idx - 1];
    }

    // Try name match (case-insensitive, partial)
    const lower = trimmed.toLowerCase();
    return (
      this._availableTeams.find((t) => t.name.toLowerCase().includes(lower)) ??
      null
    );
  }

  /** Format team list for display to user */
  formatTeamList(): string {
    if (!this._availableTeams.length) return '(Không có team nào)';
    return this._availableTeams.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
  }
}
