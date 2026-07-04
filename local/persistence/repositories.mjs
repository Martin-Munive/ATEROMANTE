import { randomUUID } from 'node:crypto';
import { hashFen, nowIso, STANDARD_STARTING_FEN } from './database.mjs';

function id(prefix) {
  return `${prefix}_${randomUUID()}`;
}

function json(value) {
  return JSON.stringify(value ?? {});
}

function booleanInt(value) {
  return value ? 1 : 0;
}

function rowToEvent(row) {
  return {
    ...row,
    payload: JSON.parse(row.payload_json),
  };
}

export class EventLogRepository {
  constructor(db) {
    this.db = db;
  }

  appendEvent({
    eventType,
    sessionId = null,
    gameId = null,
    moveId = null,
    positionId = null,
    actorId = null,
    payload = {},
    occurredAt = nowIso(),
  }) {
    const eventId = id('evt');
    this.db.prepare(`
      INSERT INTO event_log (
        id, event_type, occurred_at, session_id, game_id, move_id, position_id, actor_id, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, eventType, occurredAt, sessionId, gameId, moveId, positionId, actorId, json(payload));

    return this.db.prepare('SELECT * FROM event_log WHERE id = ?').get(eventId);
  }

  listEventsBySession(sessionId) {
    return this.db
      .prepare('SELECT * FROM event_log WHERE session_id = ? ORDER BY sequence ASC')
      .all(sessionId)
      .map(rowToEvent);
  }

  listEventsByGame(gameId) {
    return this.db
      .prepare('SELECT * FROM event_log WHERE game_id = ? ORDER BY sequence ASC')
      .all(gameId)
      .map(rowToEvent);
  }
}

export class SessionRepository {
  constructor(db, eventLog = new EventLogRepository(db)) {
    this.db = db;
    this.eventLog = eventLog;
  }

  createStudent({ displayName }) {
    const studentId = id('stu');
    this.db.prepare('INSERT INTO students (id, display_name, created_at) VALUES (?, ?, ?)')
      .run(studentId, displayName, nowIso());
    return this.getStudent(studentId);
  }

  getStudent(studentId) {
    return this.db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  }

  createSession({
    studentId = null,
    mode = 'solo-practice',
    stationRole = 'hybrid',
    status = 'ready',
    matchPolicy = {},
  } = {}) {
    const policy = {
      tutorVisibility: matchPolicy.tutorVisibility ?? 'private',
      assistanceTiming: matchPolicy.assistanceTiming ?? 'live',
      enginePermission: matchPolicy.enginePermission ?? 'evaluation-only',
      allowStudyBranches: matchPolicy.allowStudyBranches ?? true,
      markExportsAsAssisted: matchPolicy.markExportsAsAssisted ?? true,
    };

    const policyId = id('pol');
    const sessionId = id('ses');
    const timestamp = nowIso();

    this.db.exec('BEGIN');
    try {
      this.db.prepare(`
        INSERT INTO match_policies (
          id, tutor_visibility, assistance_timing, engine_permission,
          allow_study_branches, mark_exports_as_assisted, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        policyId,
        policy.tutorVisibility,
        policy.assistanceTiming,
        policy.enginePermission,
        booleanInt(policy.allowStudyBranches),
        booleanInt(policy.markExportsAsAssisted),
        timestamp,
      );

      this.db.prepare(`
        INSERT INTO study_sessions (
          id, student_id, mode, station_role, match_policy_id, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sessionId, studentId, mode, stationRole, policyId, status, timestamp, timestamp);

      this.eventLog.appendEvent({
        eventType: 'session.created',
        sessionId,
        payload: { mode, stationRole, status, matchPolicy: policy },
        occurredAt: timestamp,
      });

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return this.getSession(sessionId);
  }

  getSession(sessionId) {
    return this.db.prepare(`
      SELECT
        s.*,
        mp.tutor_visibility,
        mp.assistance_timing,
        mp.engine_permission,
        mp.allow_study_branches,
        mp.mark_exports_as_assisted
      FROM study_sessions s
      JOIN match_policies mp ON mp.id = s.match_policy_id
      WHERE s.id = ?
    `).get(sessionId);
  }

  listRecentSessions(limit = 10) {
    return this.db
      .prepare('SELECT * FROM study_sessions ORDER BY created_at DESC LIMIT ?')
      .all(limit);
  }
}

export class GameRepository {
  constructor(db, eventLog = new EventLogRepository(db)) {
    this.db = db;
    this.eventLog = eventLog;
  }

  createGame({
    sessionId,
    source = 'local',
    externalId = null,
    initialFen = STANDARD_STARTING_FEN,
    tutorPolicy = 'private-live',
    enginePolicy = 'evaluation-only',
    assistedTraining = true,
  }) {
    const gameId = id('gam');
    const timestamp = nowIso();

    this.db.prepare(`
      INSERT INTO games (
        id, session_id, source, external_id, initial_fen, assisted_training,
        tutor_policy, engine_policy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      gameId,
      sessionId,
      source,
      externalId,
      initialFen,
      booleanInt(assistedTraining),
      tutorPolicy,
      enginePolicy,
      timestamp,
      timestamp,
    );

    this.eventLog.appendEvent({
      eventType: 'game.created',
      sessionId,
      gameId,
      payload: { source, externalId, initialFen, tutorPolicy, enginePolicy, assistedTraining },
      occurredAt: timestamp,
    });

    return this.getGame(gameId);
  }

  getGame(gameId) {
    return this.db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  }

  recordPosition({
    gameId,
    sessionId,
    moveId = null,
    fen,
    ply,
    sideToMove,
    phase = 'unknown',
    materialSignature = null,
    pawnStructureTags = [],
    tacticalMotifs = [],
    strategicThemes = [],
  }) {
    const positionId = id('pos');
    const timestamp = nowIso();

    this.db.prepare(`
      INSERT INTO positions (
        id, game_id, move_id, fen, fen_hash, ply, side_to_move, phase,
        material_signature, pawn_structure_tags, tactical_motifs, strategic_themes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      positionId,
      gameId,
      moveId,
      fen,
      hashFen(fen),
      ply,
      sideToMove,
      phase,
      materialSignature,
      json(pawnStructureTags),
      json(tacticalMotifs),
      json(strategicThemes),
      timestamp,
    );

    this.eventLog.appendEvent({
      eventType: 'position.recorded',
      sessionId,
      gameId,
      moveId,
      positionId,
      payload: { fen, ply, sideToMove, phase },
      occurredAt: timestamp,
    });

    return this.db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId);
  }

  appendMove({
    sessionId,
    gameId,
    positionBeforeId = null,
    positionAfterId = null,
    ply,
    san,
    uci,
    fromSquare = null,
    toSquare = null,
    piece = null,
    capturedPiece = null,
    promotion = null,
    isCheck = false,
    isMate = false,
    nag = null,
    classification = 'unknown',
    engineDelta = null,
  }) {
    const moveId = id('mov');
    const timestamp = nowIso();

    this.db.prepare(`
      INSERT INTO moves (
        id, game_id, position_before_id, position_after_id, ply, san, uci,
        from_square, to_square, piece, captured_piece, promotion, is_check, is_mate,
        nag, classification, engine_delta, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      moveId,
      gameId,
      positionBeforeId,
      positionAfterId,
      ply,
      san,
      uci,
      fromSquare,
      toSquare,
      piece,
      capturedPiece,
      promotion,
      booleanInt(isCheck),
      booleanInt(isMate),
      nag,
      classification,
      engineDelta,
      timestamp,
    );

    this.eventLog.appendEvent({
      eventType: 'move.accepted',
      sessionId,
      gameId,
      moveId,
      payload: { ply, san, uci, classification },
      occurredAt: timestamp,
    });

    return this.db.prepare('SELECT * FROM moves WHERE id = ?').get(moveId);
  }

  linkMovePositionAfter({ moveId, positionAfterId }) {
    this.db.prepare('UPDATE moves SET position_after_id = ? WHERE id = ?')
      .run(positionAfterId, moveId);
    return this.db.prepare('SELECT * FROM moves WHERE id = ?').get(moveId);
  }

  updateGameNotation({ gameId, pgn, result = '*' }) {
    this.db.prepare('UPDATE games SET pgn = ?, result = ?, updated_at = ? WHERE id = ?')
      .run(pgn, result, nowIso(), gameId);
    return this.getGame(gameId);
  }

  recordPgnHeaders({ gameId, headers = {} }) {
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO pgn_headers (
        game_id, headers_json, event, site, date, round, white, black, result, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(game_id) DO UPDATE SET
        headers_json = excluded.headers_json,
        event = excluded.event,
        site = excluded.site,
        date = excluded.date,
        round = excluded.round,
        white = excluded.white,
        black = excluded.black,
        result = excluded.result
    `).run(
      gameId,
      json(headers),
      headers.Event ?? null,
      headers.Site ?? null,
      headers.Date ?? null,
      headers.Round ?? null,
      headers.White ?? null,
      headers.Black ?? null,
      headers.Result ?? null,
      timestamp,
    );

    return this.getPgnHeaders(gameId);
  }

  getPgnHeaders(gameId) {
    const row = this.db.prepare('SELECT * FROM pgn_headers WHERE game_id = ?').get(gameId);
    if (!row) {
      return null;
    }
    return {
      ...row,
      headers: JSON.parse(row.headers_json),
    };
  }

  recordPgnSource({
    gameId,
    sourceType = 'text',
    fileName = null,
    mimeType = null,
    byteSize = null,
    pgnSha256,
  }) {
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO pgn_sources (
        game_id, source_type, file_name, mime_type, byte_size, pgn_sha256, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(game_id) DO UPDATE SET
        source_type = excluded.source_type,
        file_name = excluded.file_name,
        mime_type = excluded.mime_type,
        byte_size = excluded.byte_size,
        pgn_sha256 = excluded.pgn_sha256
    `).run(
      gameId,
      sourceType,
      fileName,
      mimeType,
      byteSize,
      pgnSha256,
      timestamp,
    );

    return this.getPgnSource(gameId);
  }

  getPgnSource(gameId) {
    return this.db.prepare('SELECT * FROM pgn_sources WHERE game_id = ?').get(gameId) ?? null;
  }

  recordPgnAnnotations({ gameId, annotations = [] }) {
    const timestamp = nowIso();
    const insert = this.db.prepare(`
      INSERT INTO pgn_annotations (
        id, game_id, position_id, fen, ply, annotation_type, value, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const annotation of annotations) {
      insert.run(
        id('ann'),
        gameId,
        annotation.positionId ?? null,
        annotation.fen,
        annotation.ply ?? null,
        annotation.annotationType,
        annotation.value,
        timestamp,
      );
    }

    return this.listPgnAnnotations(gameId);
  }

  listPgnAnnotations(gameId) {
    return this.db
      .prepare('SELECT * FROM pgn_annotations WHERE game_id = ? ORDER BY COALESCE(ply, 0), created_at ASC')
      .all(gameId);
  }

  recordPgnVariations({ gameId, variations = [] }) {
    const timestamp = nowIso();
    const insert = this.db.prepare(`
      INSERT INTO pgn_variations (
        id, game_id, parent_ply, parent_fen, parent_variation_index, variation_index, depth, san_line, raw_pgn, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const variation of variations) {
      insert.run(
        id('var'),
        gameId,
        variation.parentPly ?? null,
        variation.parentFen ?? null,
        variation.parentVariationIndex ?? null,
        variation.variationIndex,
        variation.depth ?? 1,
        variation.sanLine,
        variation.rawPgn,
        timestamp,
      );
    }

    return this.listPgnVariations(gameId);
  }

  listPgnVariations(gameId) {
    return this.db
      .prepare('SELECT * FROM pgn_variations WHERE game_id = ? ORDER BY variation_index ASC')
      .all(gameId);
  }

  getGameTimeline(gameId) {
    return {
      game: this.getGame(gameId),
      pgnHeaders: this.getPgnHeaders(gameId),
      pgnSource: this.getPgnSource(gameId),
      pgnAnnotations: this.listPgnAnnotations(gameId),
      pgnVariations: this.listPgnVariations(gameId),
      positions: this.db.prepare('SELECT * FROM positions WHERE game_id = ? ORDER BY ply ASC').all(gameId),
      moves: this.db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY ply ASC').all(gameId),
      events: this.eventLog.listEventsByGame(gameId),
    };
  }

  listRecentGames(limit = 10) {
    return this.db.prepare(`
      SELECT
        g.*,
        s.mode,
        s.station_role,
        s.status,
        s.created_at AS session_created_at,
        s.updated_at AS session_updated_at,
        COUNT(m.id) AS move_count
      FROM games g
      JOIN study_sessions s ON s.id = g.session_id
      LEFT JOIN moves m ON m.game_id = g.id
      GROUP BY g.id
      ORDER BY g.updated_at DESC, g.created_at DESC
      LIMIT ?
    `).all(limit);
  }
}

export class EngineEvaluationRepository {
  constructor(db, eventLog = new EventLogRepository(db)) {
    this.db = db;
    this.eventLog = eventLog;
  }

  recordEvaluation({
    sessionId,
    gameId,
    moveId = null,
    positionId = null,
    engineName,
    depth = null,
    multipv = 1,
    scoreCp = null,
    scoreMate = null,
    bestMove,
    principalVariation = [],
  }) {
    const evaluationId = id('eng');
    const timestamp = nowIso();

    this.db.exec('BEGIN');
    try {
      this.db.prepare(`
        INSERT INTO engine_evaluations (
          id, game_id, move_id, position_id, engine_name, depth, multipv,
          score_cp, score_mate, best_move, pv_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        evaluationId,
        gameId,
        moveId,
        positionId,
        engineName,
        depth,
        multipv,
        scoreCp,
        scoreMate,
        bestMove,
        json(principalVariation),
        timestamp,
      );

      this.eventLog.appendEvent({
        eventType: 'engine.analysis.completed',
        sessionId,
        gameId,
        moveId,
        positionId,
        payload: { evaluationId, engineName, depth, scoreCp, scoreMate, bestMove },
        occurredAt: timestamp,
      });
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return this.getEvaluation(evaluationId);
  }

  getEvaluation(evaluationId) {
    return this.db.prepare('SELECT * FROM engine_evaluations WHERE id = ?').get(evaluationId);
  }

  listByGame(gameId) {
    return this.db
      .prepare('SELECT * FROM engine_evaluations WHERE game_id = ? ORDER BY created_at DESC')
      .all(gameId);
  }
}

export class TutorEventRepository {
  constructor(db, eventLog = new EventLogRepository(db)) {
    this.db = db;
    this.eventLog = eventLog;
  }

  recordTutorEvent({
    sessionId,
    gameId,
    moveId = null,
    positionId = null,
    llmProviderId,
    tutorMode,
    visibility = 'private',
    summary,
    teachingFocus = [],
    annotations = [],
    confidence = 'low',
  }) {
    const tutorEventId = id('tut');
    const timestamp = nowIso();

    this.db.exec('BEGIN');
    try {
      this.db.prepare(`
        INSERT INTO tutor_events (
          id, session_id, game_id, move_id, position_id, llm_provider_id, tutor_mode,
          visibility, summary, teaching_focus_json, annotations_json, confidence, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        tutorEventId,
        sessionId,
        gameId,
        moveId,
        positionId,
        llmProviderId,
        tutorMode,
        visibility,
        summary,
        json(teachingFocus),
        json(annotations),
        confidence,
        timestamp,
      );

      this.eventLog.appendEvent({
        eventType: 'tutor.explanation.created',
        sessionId,
        gameId,
        moveId,
        positionId,
        payload: { tutorEventId, llmProviderId, tutorMode, visibility, confidence },
        occurredAt: timestamp,
      });
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return this.getTutorEvent(tutorEventId);
  }

  getTutorEvent(tutorEventId) {
    const row = this.db.prepare('SELECT * FROM tutor_events WHERE id = ?').get(tutorEventId);
    if (!row) {
      return null;
    }
    return {
      ...row,
      teaching_focus: JSON.parse(row.teaching_focus_json),
      annotations: JSON.parse(row.annotations_json),
    };
  }

  listByGame(gameId) {
    return this.db
      .prepare('SELECT * FROM tutor_events WHERE game_id = ? ORDER BY created_at DESC')
      .all(gameId)
      .map((row) => ({
        ...row,
        teaching_focus: JSON.parse(row.teaching_focus_json),
        annotations: JSON.parse(row.annotations_json),
      }));
  }
}

export class LearningRepository {
  constructor(db, eventLog = new EventLogRepository(db)) {
    this.db = db;
    this.eventLog = eventLog;
  }

  createLearningEvent({
    sessionId,
    gameId = null,
    moveId = null,
    positionId = null,
    tutorEventId = null,
    eventType,
    theme,
    skill,
    summary,
    explanation = '',
    studentAction = null,
    confidence = 'medium',
    masteryState = 'new',
    tags = [],
  }) {
    const learningEventId = id('learn');
    const timestamp = nowIso();

    this.db.exec('BEGIN');
    try {
      this.db.prepare(`
        INSERT INTO learning_events (
          id, session_id, game_id, move_id, position_id, tutor_event_id, event_type,
          theme, skill, summary, explanation, student_action, confidence, mastery_state, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        learningEventId,
        sessionId,
        gameId,
        moveId,
        positionId,
        tutorEventId,
        eventType,
        theme,
        skill,
        summary,
        explanation,
        studentAction,
        confidence,
        masteryState,
        timestamp,
      );

      for (const tag of tags) {
        const tagId = this.ensureTag(tag);
        this.db.prepare('INSERT OR IGNORE INTO learning_event_tags (learning_event_id, tag_id) VALUES (?, ?)')
          .run(learningEventId, tagId);
      }

      this.eventLog.appendEvent({
        eventType: 'learning.event.created',
        sessionId,
        gameId,
        moveId,
        positionId,
        payload: { learningEventId, eventType, theme, skill, tags },
        occurredAt: timestamp,
      });

      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return this.getLearningEvent(learningEventId);
  }

  ensureTag({ name, category = 'general' }) {
    const existing = this.db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
    if (existing) {
      return existing.id;
    }

    const tagId = id('tag');
    this.db.prepare('INSERT INTO tags (id, name, category) VALUES (?, ?, ?)')
      .run(tagId, name, category);
    return tagId;
  }

  getLearningEvent(learningEventId) {
    return this.db.prepare('SELECT * FROM learning_events WHERE id = ?').get(learningEventId);
  }

  findLearningEvents({ theme = null, skill = null, positionId = null } = {}) {
    const clauses = [];
    const values = [];

    if (theme) {
      clauses.push('theme = ?');
      values.push(theme);
    }
    if (skill) {
      clauses.push('skill = ?');
      values.push(skill);
    }
    if (positionId) {
      clauses.push('position_id = ?');
      values.push(positionId);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return this.db
      .prepare(`SELECT * FROM learning_events ${where} ORDER BY created_at DESC`)
      .all(...values);
  }

  listByGame(gameId) {
    return this.db
      .prepare('SELECT * FROM learning_events WHERE game_id = ? ORDER BY created_at DESC')
      .all(gameId);
  }

  createReviewItem({
    learningEventId,
    dueAt = null,
    intervalDays = 1,
    ease = 2.5,
    lastResult = null,
    nextPromptType = 'position-recall',
  }) {
    const reviewItemId = id('rev');
    const timestamp = nowIso();
    const dueDate = dueAt ?? new Date(Date.now() + intervalDays * 24 * 60 * 60 * 1000).toISOString();

    this.db.prepare(`
      INSERT INTO review_items (
        id, learning_event_id, due_at, interval_days, ease, last_result,
        next_prompt_type, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      reviewItemId,
      learningEventId,
      dueDate,
      intervalDays,
      ease,
      lastResult,
      nextPromptType,
      timestamp,
      timestamp,
    );

    const learningEvent = this.getLearningEvent(learningEventId);
    this.eventLog.appendEvent({
      eventType: 'review.item.created',
      sessionId: learningEvent?.session_id ?? null,
      gameId: learningEvent?.game_id ?? null,
      moveId: learningEvent?.move_id ?? null,
      positionId: learningEvent?.position_id ?? null,
      payload: { reviewItemId, learningEventId, dueAt: dueDate, intervalDays, nextPromptType },
      occurredAt: timestamp,
    });

    return this.getReviewItem(reviewItemId);
  }

  getReviewItem(reviewItemId) {
    return this.db.prepare('SELECT * FROM review_items WHERE id = ?').get(reviewItemId);
  }

  getReviewItemDetail(reviewItemId) {
    return this.db.prepare(`
      SELECT
        ri.*,
        le.session_id,
        le.game_id,
        le.move_id,
        le.position_id,
        le.theme,
        le.skill,
        le.summary,
        le.mastery_state,
        le.confidence,
        p.fen AS position_fen,
        p.ply AS position_ply,
        p.side_to_move,
        (
          SELECT ra.answer_text
          FROM review_attempts ra
          WHERE ra.review_item_id = ri.id
          ORDER BY ra.created_at DESC
          LIMIT 1
        ) AS latest_answer
      FROM review_items ri
      JOIN learning_events le ON le.id = ri.learning_event_id
      LEFT JOIN positions p ON p.id = le.position_id
      WHERE ri.id = ?
    `).get(reviewItemId);
  }

  recordReviewResult({ reviewItemId, result, answerText = '' }) {
    const allowedResults = new Set(['again', 'hard', 'good', 'easy']);
    if (!allowedResults.has(result)) {
      throw new Error('invalid_review_result');
    }

    const current = this.getReviewItemDetail(reviewItemId);
    if (!current) {
      return null;
    }

    const nextEase = Math.max(1.3, current.ease + ({
      again: -0.25,
      hard: -0.1,
      good: 0,
      easy: 0.15,
    })[result]);
    const nextIntervalDays = ({
      again: 1,
      hard: Math.max(1, Math.ceil(current.interval_days * 1.2)),
      good: Math.max(1, Math.ceil(current.interval_days * nextEase)),
      easy: Math.max(2, Math.ceil(current.interval_days * (nextEase + 0.5))),
    })[result];
    const masteryState = ({
      again: 'weak',
      hard: 'reviewing',
      good: 'learning',
      easy: 'stable',
    })[result];
    const timestamp = nowIso();
    const dueAt = new Date(Date.now() + nextIntervalDays * 24 * 60 * 60 * 1000).toISOString();
    const answer = typeof answerText === 'string' ? answerText.trim().slice(0, 2000) : '';

    this.db.exec('BEGIN');
    try {
      this.db.prepare(`
        INSERT INTO review_attempts (id, review_item_id, result, answer_text, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id('att'), reviewItemId, result, answer, timestamp);
      this.db.prepare(`
        UPDATE review_items
        SET due_at = ?, interval_days = ?, ease = ?, last_result = ?, updated_at = ?
        WHERE id = ?
      `).run(dueAt, nextIntervalDays, nextEase, result, timestamp, reviewItemId);
      this.db.prepare('UPDATE learning_events SET mastery_state = ? WHERE id = ?')
        .run(masteryState, current.learning_event_id);
      this.eventLog.appendEvent({
        eventType: 'review.item.answered',
        sessionId: current.session_id,
        gameId: current.game_id,
        moveId: current.move_id,
        positionId: current.position_id,
        payload: {
          reviewItemId,
          learningEventId: current.learning_event_id,
          result,
          dueAt,
          intervalDays: nextIntervalDays,
          ease: nextEase,
          masteryState,
          answerLength: answer.length,
        },
        occurredAt: timestamp,
      });
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return this.getReviewItemDetail(reviewItemId);
  }

  listReviewItems({ gameId = null, limit = 10 } = {}) {
    const boundedLimit = Number.isInteger(limit) && limit > 0 && limit <= 50 ? limit : 10;
    const where = gameId ? 'WHERE le.game_id = ?' : '';
    const values = gameId ? [gameId, boundedLimit] : [boundedLimit];

    return this.db.prepare(`
      SELECT
        ri.*,
        le.session_id,
        le.game_id,
        le.move_id,
        le.position_id,
        le.theme,
        le.skill,
        le.summary,
        le.mastery_state,
        le.confidence,
        p.fen AS position_fen,
        p.ply AS position_ply,
        p.side_to_move,
        (
          SELECT ra.answer_text
          FROM review_attempts ra
          WHERE ra.review_item_id = ri.id
          ORDER BY ra.created_at DESC
          LIMIT 1
        ) AS latest_answer
      FROM review_items ri
      JOIN learning_events le ON le.id = ri.learning_event_id
      LEFT JOIN positions p ON p.id = le.position_id
      ${where}
      ORDER BY ri.due_at ASC, ri.created_at ASC
      LIMIT ?
    `).all(...values);
  }
}
