<template>
  <div class="chair-container">
    <header class="page-header">
      <div class="header-row">
        <div class="header-title">
          <h1>{{ store.title || '主席控制台' }}</h1>
          <span class="badge badge-accent">{{ store.meetingPhase }}</span>
        </div>
        <div class="header-icons">
          <button class="btn btn-ghost btn-icon" title="會議設定" @click="router.push('/chair/' + confId + '/settings')">⚙️</button>
          <button class="btn btn-ghost btn-icon" title="我的會議" @click="router.push('/')">📋</button>
          <button class="btn btn-ghost btn-icon" title="登出" @click="handleLogout">🚪</button>
        </div>
      </div>

      <div class="header-row toolbar">
        <select class="agenda-select" :value="store.currentSection" @change="store.setSection($event.target.value)">
          <option v-for="a in store.agenda" :key="a.id" :value="a.label">{{ a.label }}</option>
        </select>

        <button class="btn btn-secondary btn-sm" @click="openScreenView">📺 代表端</button>
        <button class="btn btn-secondary btn-sm" @click="openDocsView">📚 文件庫</button>
        <button class="btn btn-secondary btn-sm" @click="router.push('/stats/' + confId)">📊 統計</button>

        <div class="toolbar-spacer"></div>

        <button v-if="store.screenMode !== 'suspended'" class="btn btn-secondary btn-sm" @click="store.suspendMeeting">⏸️ 暫停</button>
        <button v-else class="btn btn-primary btn-sm" @click="store.resumeMeeting">▶️ 恢復</button>
        <button v-if="store.screenMode !== 'default'" class="btn btn-secondary btn-sm" @click="store.returnToDebate()">✅ 返回辯論</button>

        <div class="more-menu">
          <button class="btn btn-ghost btn-icon" title="更多操作" @click="showMoreMenu = !showMoreMenu">⋯</button>
          <div v-if="showMoreMenu" class="menu-overlay" @click="showMoreMenu = false"></div>
          <div v-if="showMoreMenu" class="menu-panel">
            <button class="menu-item" @click="handleSaveProgress(); showMoreMenu = false">💾 儲存進度</button>
            <button class="menu-item" @click="clearStats(); showMoreMenu = false">🗑️ 清除統計</button>
            <button class="menu-item menu-item-danger" @click="store.resetMeeting(); showMoreMenu = false">⚠️ 重置會議</button>
          </div>
        </div>
      </div>
    </header>

    <div class="grid-layout">
      <div class="column left">
        <!-- 唱名表決控制區 -->
        <div class="card" v-if="store.screenMode === 'voting_roll_call'">
          <h3>🗳️ 唱名表決控制</h3>
          <div class="doc-vote-title" v-if="store.votingTopic">議題：{{ store.votingTopic }}</div>
          <div class="voting-controls-header">
            <span class="muted-text">輪次：{{ store.votingRound2 ? '第二輪 (僅贊成/反對)' : '第一輪 (完整)' }}</span>
            <div class="row-actions">
              <button class="btn btn-secondary btn-sm" v-if="!store.votingRound2" @click="store.nextVotingRound()">⏭️ 進入第二輪</button>
              <button class="btn btn-ghost btn-sm" @click="handleResetVoting">🔄 重新表決</button>
              <button class="btn btn-primary btn-sm" @click="store.endVotingRollCall()">✅ 結束投票並顯示結果</button>
            </div>
          </div>

          <div class="delegates-grid">
            <div v-for="d in store.delegates.filter(x => x.type === 'member')" :key="d.name" class="delegate-row" :class="{ voted: store.rollCallVoteData[d.name] }">
              <span class="d-name">{{ d.name }}</span>
              <div class="d-status">
                <span v-if="store.rollCallVoteData[d.name]" class="badge badge-success">{{ getVoteLabel(store.rollCallVoteData[d.name]) }}</span>
                <span v-else class="badge badge-neutral">待投票</span>
              </div>
              <div class="d-actions">
                <button class="btn btn-secondary btn-sm" @click="openVoteModal(d.name)">投票</button>
                <button class="btn btn-ghost btn-sm" v-if="store.rollCallVoteData[d.name]" @click="store.recordRollCallVote(d.name, null)">清除</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 共識決控制區 -->
        <div class="card" v-else-if="store.screenMode === 'voting_consensus'">
          <h3>🤝 共識決投票</h3>
          <div class="doc-vote-title" v-if="store.votingTopic">議題：{{ store.votingTopic }}</div>
          <div v-if="!store.consensusResult" class="consensus-controls">
            <button class="btn btn-success btn-block" @click="store.setConsensusResult('pass')">✅ 通過</button>
            <button class="btn btn-danger btn-block" @click="store.setConsensusResult('fail')">❌ 不通過</button>
          </div>
          <div v-else class="consensus-result-box">
            <p>結果已同步至代表端：<strong>{{ store.consensusResult === 'pass' ? '✅ 通過' : '❌ 不通過' }}</strong></p>
            <button class="btn btn-primary btn-block" @click="store.finishConsensus()">✅ 返回辯論</button>
          </div>
        </div>

        <!-- 文件介紹表決控制區 -->
        <div class="card" v-else-if="store.screenMode === 'doc_voting' && votingDoc">
          <h3>🗳️ {{ votingDoc.type === 'A' ? '修正案表決' : '介紹決議草案' }}</h3>
          <div class="doc-vote-summary">
            <div class="doc-vote-title">[{{ votingDoc.type }} {{ votingDoc.number }}] {{ votingDoc.title }}</div>
            <template v-if="votingDoc.type === 'A'">
              <div class="doc-vote-row"><span class="muted-text">提案國</span><span>{{ votingDoc.sponsor || '未指定' }}</span></div>
              <div class="doc-vote-row"><span class="muted-text">目標草案</span><span>{{ docLabel(votingDoc.targetDocId) }}</span></div>
              <div class="doc-vote-row"><span class="muted-text">條款</span><span>{{ votingDoc.clause }}</span></div>
              <div class="doc-vote-row"><span class="muted-text">修改類型</span><span class="badge badge-accent">{{ votingDoc.actionType }}</span></div>
              <p class="doc-vote-change">{{ votingDoc.changeText }}</p>
            </template>
          </div>
          <div class="consensus-controls">
            <button class="btn btn-success btn-block" @click="store.resolveDocVote(true)">✅ 通過</button>
            <button class="btn btn-danger btn-block" @click="store.resolveDocVote(false)">❌ 不通過</button>
          </div>
          <button class="btn btn-ghost btn-block cancel-doc-vote" @click="store.cancelDocVote()">取消，返回辯論（不記錄結果）</button>
        </div>

        <!-- 程序性動議表決控制區 -->
        <div class="card" v-else-if="store.screenMode === 'motion_voting' && store.currentVotingMotion">
          <h3>🗳️ 動議表決</h3>
          <div class="doc-vote-summary">
            <div class="doc-vote-title">{{ store.currentVotingMotion.type }}</div>
            <div class="doc-vote-row"><span class="muted-text">動議國</span><span>{{ store.currentVotingMotion.country }}</span></div>
            <div class="doc-vote-row" v-if="store.currentVotingMotion.details?.topic"><span class="muted-text">主題</span><span>{{ store.currentVotingMotion.details.topic }}</span></div>
            <div class="doc-vote-row" v-if="store.currentVotingMotion.details?.duration"><span class="muted-text">時長</span><span>{{ store.currentVotingMotion.details.duration }} 分</span></div>
            <div class="doc-vote-row" v-if="store.currentVotingMotion.details?.totalTime"><span class="muted-text">總時長</span><span>{{ store.currentVotingMotion.details.totalTime }} 分</span></div>
            <div class="doc-vote-row" v-if="store.currentVotingMotion.details?.docId"><span class="muted-text">目標文件</span><span>{{ docLabel(store.currentVotingMotion.details.docId) }}</span></div>
          </div>
          <p class="muted-text form-hint">現場舉牌表決後，由主席記錄結果。</p>
          <div class="consensus-controls">
            <button class="btn btn-success btn-block" @click="store.passMotionVote()">✅ 表決通過</button>
            <button class="btn btn-danger btn-block" @click="store.failMotionVote()">❌ 表決未通過</button>
          </div>
        </div>

        <!-- 修正案辯論：特設發言人名單（支持／反對） -->
        <div class="card" v-else-if="store.screenMode === 'amend_debate'">
          <h3>🎤 修正案辯論（特設發言名單）</h3>
          <div class="doc-vote-summary" v-if="votingDoc">
            <div class="doc-vote-title">[{{ votingDoc.type }} {{ votingDoc.number }}] {{ votingDoc.title }}</div>
            <div class="doc-vote-row"><span class="muted-text">目標草案</span><span>{{ docLabel(votingDoc.targetDocId) }}</span></div>
            <div class="doc-vote-row"><span class="muted-text">條款／類型</span><span>{{ votingDoc.clause }} · {{ votingDoc.actionType }}</span></div>
          </div>
          <div class="current-speaker-box">
            <span class="muted-text">當前發言人</span>
            <strong>{{ store.currentAmendSpeaker || '無' }}<span v-if="store.currentAmendSide" class="badge" :class="store.currentAmendSide === 'for' ? 'badge-success' : 'badge-danger'">{{ store.currentAmendSide === 'for' ? '支持' : '反對' }}</span></strong>
            <span class="timer-display">{{ formatTime(store.amendSpeakerTimer) }}</span>
          </div>
          <div class="input-row">
            <label class="field-label">預設時長(秒)</label>
            <input v-model.number="amendTimeInput" @change="store.amendDefaultTime = Math.max(10, amendTimeInput)" type="number" min="10" />
          </div>
          <div class="input-row">
            <select v-model="amendSelCountry">
              <option value="">選擇國家（{{ amendAvailableDelegates.length }} 位尚未登記）</option>
              <option v-for="d in amendAvailableDelegates" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
            <button class="btn btn-success btn-sm" :disabled="!amendSelCountry" @click="store.addAmendSpeaker(amendSelCountry, 'for'); amendSelCountry=''">＋支持</button>
            <button class="btn btn-danger btn-sm" :disabled="!amendSelCountry" @click="store.addAmendSpeaker(amendSelCountry, 'against'); amendSelCountry=''">＋反對</button>
          </div>
          <div class="list-scroll">
            <div v-for="(spk, i) in store.amendSpeakers" :key="i" class="list-item">
              <span>{{ spk.country }}</span>
              <span class="badge" :class="spk.side === 'for' ? 'badge-success' : 'badge-danger'">{{ spk.side === 'for' ? '支持' : '反對' }}</span>
              <button class="btn btn-ghost btn-sm remove-btn" title="移除" @click="store.removeAmendSpeaker(spk.country)">✕</button>
            </div>
            <div v-if="store.amendSpeakers.length === 0" class="empty">尚無登記發言（支持/反對各建議 2 位）</div>
          </div>
          <div class="timer-control-row">
            <button class="btn btn-secondary" @click="store.nextAmendSpeaker">➡️ 下一位</button>
            <button class="btn" :class="store.isAmendTimerRunning ? 'btn-primary' : 'btn-secondary'" @click="store.toggleAmendTimer">{{ store.isAmendTimerRunning ? '⏸️ 暫停' : '▶️ 開始' }}</button>
            <button class="btn btn-warning" @click="store.startAmendVote()">🗳️ 結束辯論，進入表決</button>
          </div>
        </div>

        <!-- 常設發言人名單 -->
        <div class="card" v-else>
          <h3>🎤 常設發言人名單</h3>
          <div class="current-speaker-box">
            <span class="muted-text">當前發言人</span>
            <strong>{{ store.currentGeneralSpeaker || '無' }}</strong>
            <span class="timer-display">{{ formatTime(store.generalSpeakerTimer) }}</span>
          </div>
          <div class="input-row">
            <label class="field-label">預設時長(秒)</label>
            <input v-model.number="timeLimitInput" @change="store.generalTimeLimit = Math.max(10, timeLimitInput)" type="number" min="10" />
          </div>
          <div class="input-row">
            <select v-model="selCountry">
              <option value="">選擇國家（{{ generalAvailableDelegates.length }} 位尚未登記）</option>
              <option v-for="d in generalAvailableDelegates" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
            <button class="btn btn-secondary" :disabled="!selCountry" @click="store.addToGeneralList(selCountry); selCountry=''">加入名單</button>
          </div>
          <div class="list-scroll">
            <div v-for="(spk, i) in store.generalList" :key="i" class="list-item">
              <span>{{ spk.country }}</span>
              <button class="btn btn-ghost btn-sm remove-btn" title="移除" @click="store.removeFromGeneralList(spk.country)">✕</button>
            </div>
            <div v-if="store.generalList.length === 0" class="empty">無登記代表</div>
          </div>
          <div class="timer-control-row">
            <button class="btn btn-secondary" @click="store.nextGeneralSpeaker">➡️ 下一位</button>
            <select v-model="yieldTarget" class="yield-select" :disabled="!store.currentGeneralSpeaker || store.generalSpeakerTimer <= 0">
              <option value="">🔄 讓渡予...</option>
              <option v-for="d in yieldableDelegates" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
            <button class="btn btn-warning" :disabled="!yieldTarget" @click="store.yieldToDelegate(yieldTarget); yieldTarget=''">讓渡</button>
            <button class="btn" :class="store.isGeneralTimerRunning ? 'btn-primary' : 'btn-secondary'" @click="store.toggleGeneralTimer">
              {{ store.isGeneralTimerRunning ? '⏸️ 暫停' : '▶️ 開始' }}
            </button>
          </div>
        </div>

        <!-- 點名系統 -->
        <div class="card roll-call-control" v-if="!['voting_roll_call', 'voting_consensus', 'doc_voting', 'motion_voting', 'amend_debate'].includes(store.screenMode)">
          <h3>📋 點名系統</h3>
          <div v-if="!store.isRollCallActive" class="rc-trigger">
            <button class="btn btn-primary btn-block" @click="store.startRollCall()">📢 開始點名 (同步至代表端)</button>
          </div>
          <div v-else class="rc-active-panel">
            <div class="rc-status">進行中... 已點 {{ Object.values(store.rollCallStatus).filter(s => s).length }} / {{ store.delegates.length }} 席</div>
            <div class="roll-call-grid">
              <div v-for="d in store.delegates" :key="d.name" class="roll-call-item">
                <span class="rc-name">{{ d.name }}</span>
                <div class="rc-buttons">
                  <button :class="['rc-btn', store.rollCallStatus[d.name] === 'present' ? 'active-present' : '']" @click="store.markRollCall(d.name, 'present')">出席</button>
                  <button :class="['rc-btn', store.rollCallStatus[d.name] === 'late' ? 'active-late' : '']" @click="store.markRollCall(d.name, 'late')">遲到</button>
                  <button :class="['rc-btn', store.rollCallStatus[d.name] === 'absent' ? 'active-absent' : '']" @click="store.markRollCall(d.name, 'absent')">缺席</button>
                  <button v-if="store.rollCallStatus[d.name] === 'present'" class="rc-btn-change-late" @click="store.changeToLate(d.name)">↪️ 改遲到</button>
                </div>
              </div>
            </div>
            <button class="btn btn-primary btn-block" @click="store.endRollCall()">✅ 點名完畢，返回會議</button>
          </div>
        </div>
      </div>

      <div class="column right">
        <div class="card">
          <h3>📜 動議佇列</h3>
          <div class="motion-form">
            <select v-model="mType" @change="mDetails={}">
              <option value="">選擇動議類型</option>
              <option v-for="t in ['自由磋商','全體諮詢','有主持核心磋商','暫停會議','恢復會議','介紹決議草案','介紹修正案','P5閉門協商','唱名表決','共識決']" :key="t" :value="t">{{ t }}</option>
            </select>
            <select v-model="mCountry">
              <option value="">動議國</option>
              <option v-for="d in store.delegates.filter(d=>d.type==='member')" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
            <template v-if="mType === '自由磋商' || mType === '全體諮詢'">
              <input v-model.number="mDetails.duration" type="number" placeholder="時長(分)" />
            </template>
            <template v-if="mType === '有主持核心磋商'">
              <input v-model="mDetails.topic" placeholder="磋商主題" />
              <input v-model.number="mDetails.totalTime" type="number" placeholder="總時長(分)" />
              <input v-model.number="mDetails.speakTime" type="number" placeholder="每人發言(秒)" />
            </template>
            <template v-if="mType === '唱名表決' || mType === '共識決'">
              <input v-model="mDetails.topic" placeholder="表決議題（如：決議草案 DR 1.1）" />
            </template>
            <template v-if="mType === '介紹決議草案'">
              <select v-model="mDetails.docId">
                <option value="">選擇要介紹的潛在決議草案</option>
                <option v-for="d in introDrDocs" :key="d.id" :value="d.id">[DR {{ d.number }}] {{ d.title }}</option>
              </select>
            </template>
            <template v-if="mType === '介紹修正案'">
              <select v-model="mDetails.docId">
                <option value="">選擇要介紹的修正案</option>
                <option v-for="d in introAmendDocs" :key="d.id" :value="d.id">[A {{ d.number }}] {{ d.title }}</option>
              </select>
            </template>
            <button class="btn btn-primary btn-block" :disabled="!canSubmitMotion" @click="store.submitMotion(mType, mCountry, mDetails)">📥 提交動議</button>
          </div>

          <div class="queue-list">
            <div v-for="(m, i) in store.motionQueue" :key="m.id" class="queue-item">
              <span>{{ m.type }} - {{ m.country }}</span>
              <div class="row-actions">
                <button class="btn btn-success btn-sm" @click="store.bringMotionToVote(i)">🗳️ 受理表決</button>
                <button class="btn btn-danger btn-sm" @click="store.rejectMotion(i)">✗ 駁回</button>
              </div>
            </div>
            <div v-if="store.motionQueue.length === 0" class="empty">佇列為空</div>
          </div>
          <p class="muted-text form-hint">按「受理表決」把動議放上投影供現場舉牌表決，再於左側記錄通過／未通過。</p>
        </div>

        <div class="card">
          <h3>📄 文件上傳與審核</h3>
          <div class="input-row">
            <select v-model="docType"><option value="WD">工作文件 (WD)</option><option value="DR">潛在決議草案 (DR)</option><option value="A">修正案 (A)</option></select>
            <input v-model="docNumber" placeholder="編號 (如 1.1)" /><input v-model="docTitle" placeholder="標題/議題" />
          </div>
          <template v-if="docType === 'A'">
            <div class="input-row">
              <select v-model="aTarget">
                <option value="">目標決議草案</option>
                <option v-for="d in targetableDocs" :key="d.id" :value="d.id">[DR {{ d.number }}] {{ d.title }}</option>
              </select>
              <select v-model="aSponsor">
                <option value="">提案國（選填）</option>
                <option v-for="d in store.delegates" :key="d.name" :value="d.name">{{ d.name }}</option>
              </select>
            </div>
            <div class="input-row">
              <input v-model="aClause" placeholder="條款（如 OP3、PP2）" />
              <select v-model="aAction" class="action-select">
                <option value="新增">新增</option>
                <option value="修改">修改</option>
                <option value="刪除">刪除</option>
              </select>
            </div>
            <textarea v-model="aChange" class="amend-textarea" rows="3" placeholder="修改內容（新增/修改後的完整條款文字，或說明刪除範圍）"></textarea>
          </template>
          <div class="input-row">
            <input ref="docFileInput" type="file" @change="onDocFileChange" />
            <button class="btn btn-primary" :disabled="!canSubmitDoc || docUploading" @click="submitDocUpload">{{ docUploading ? '上傳中...' : '📤 上傳並送審' }}</button>
          </div>
          <p v-if="docType === 'A'" class="muted-text form-hint">修正案的檔案為選填，投影與文件庫會直接顯示上面填的結構化內容。</p>
          <div class="doc-review-list">
            <div v-for="(doc, i) in store.documents" :key="doc.id ?? (doc.number + doc.type + i)" class="doc-review-item" :class="doc.status">
              <div class="doc-review-main">
                <span class="badge badge-neutral">[{{ doc.type }} {{ doc.number }}] {{ doc.title }}</span>
                <span v-if="doc.type === 'DR'" class="badge" :class="doc.stage === 'formal' ? 'badge-accent' : 'badge-neutral'">{{ doc.stage === 'formal' ? '決議草案' : '潛在' }}</span>
                <span v-if="doc.voteStatus" class="badge" :class="doc.voteStatus === 'passed' ? 'badge-success' : 'badge-danger'">{{ doc.voteStatus === 'passed' ? '表決通過' : '表決未過' }}</span>
                <a v-if="doc.fileURL" :href="doc.fileURL" target="_blank" class="doc-link">📎 檔案</a>
                <span class="badge" :class="doc.status === 'pending' ? 'badge-warning' : doc.status === 'rejected' ? 'badge-danger' : 'badge-success'">{{ doc.status === 'pending' ? '⏳ 待審' : doc.status === 'rejected' ? '❌ 已退回' : '✅ 已通過' }}</span>
              </div>
              <div v-if="doc.type === 'A'" class="amend-summary muted-text">
                {{ docLabel(doc.targetDocId) }} · {{ doc.clause }} · {{ doc.actionType }}{{ doc.sponsor ? ' · 提案國：' + doc.sponsor : '' }}
              </div>
              <div class="row-actions" v-if="doc.status === 'pending'">
                <button class="btn btn-success btn-sm" @click="store.reviewDocument(i, 'approved')">✓ 通過</button>
                <button class="btn btn-danger btn-sm" @click="store.reviewDocument(i, 'rejected')">✗ 退回</button>
              </div>
              <div class="row-actions" v-else-if="canIntroduce(doc)">
                <button class="btn btn-warning btn-sm" @click="store.introduceDocument(doc.id)">📢 介紹表決</button>
              </div>
            </div>
            <div v-if="store.documents.length === 0" class="empty">尚無公告文件</div>
          </div>
        </div>

        <div class="card">
          <h3>📝 發言紀錄</h3>
          <div class="input-row" v-if="activeSpeaker">
            <span class="badge badge-accent active-speaker-tag">{{ activeSpeaker }}</span>
            <input v-model="speechNoteText" placeholder="輸入對本次發言的紀錄與想法..." @keyup.enter="submitSpeechNote" />
            <button class="btn btn-secondary" :disabled="!speechNoteText" @click="submitSpeechNote">➕ 加入</button>
          </div>
          <div v-else class="empty">目前無發言人</div>
          <div class="speech-notes-list">
            <div v-for="n in store.speechNotes" :key="n.id" class="speech-note-item">
              <div class="speech-note-head"><strong>{{ n.country }}</strong><span class="muted-text">{{ n.phase }}</span></div>
              <p class="note-text">{{ n.note }}</p>
              <button class="btn-delete-note" @click="store.deleteSpeechNote(n.id)">🗑️</button>
            </div>
            <div v-if="store.speechNotes.length === 0" class="empty">尚無發言紀錄</div>
          </div>
        </div>

        <div class="card">
          <h3>📊 各國統計（發言 / 動議成功）</h3>
          <div class="mini-stats-list">
            <div v-for="c in sortedMiniStats" :key="c.name" class="mini-stats-row">
              <span class="mini-stats-name">{{ c.name }}</span>
              <span class="mini-stats-val">🎤 {{ c.speeches }}</span>
              <span class="mini-stats-val">✅ {{ c.motionsPassed }}</span>
            </div>
            <div v-if="sortedMiniStats.length === 0" class="empty">尚無統計資料</div>
          </div>
        </div>

        <div class="card" v-if="store.screenMode === 'mod_caucus'">
          <h3>🎤 有主持核心磋商控制</h3>
          <div class="mod-info-badge">每位發言人時長：<strong>{{ store.modCaucusDefaultSpeakTime || 60 }}秒</strong></div>
          <div class="input-row">
            <select v-model="modSelCountry">
              <option value="">選擇國家（{{ modAvailableDelegates.length }} 位尚未登記）</option>
              <option v-for="d in modAvailableDelegates" :key="d.name" :value="d.name">{{ d.name }}</option>
            </select>
            <button class="btn btn-secondary" :disabled="!modSelCountry" @click="store.addToModCaucus(modSelCountry); modSelCountry=''">加入特設名單</button>
          </div>
          <div class="list-scroll">
            <div v-for="(spk, i) in store.modCaucusList" :key="i" class="list-item mod-item">
              <span>{{ i + 1 }}. {{ spk.country }} ({{ spk.time }}s)</span>
              <button class="btn btn-ghost btn-sm remove-btn" title="移除" @click="store.removeFromModCaucus(spk.country)">✕</button>
            </div>
            <div v-if="store.modCaucusList.length === 0" class="empty">暫無特設代表</div>
          </div>
          <div class="timer-control-row">
            <button class="btn btn-secondary" @click="store.nextModSpeaker">➡️ 下一位</button>
            <button class="btn" :class="store.isModCaucusRunning ? 'btn-primary' : 'btn-secondary'" @click="store.toggleModCaucusTimer">{{ store.isModCaucusRunning ? '⏸️ 暫停' : '▶️ 開始' }}</button>
            <button class="btn btn-danger" @click="store.modCaucusList = []; store.currentModSpeaker = ''; store.modCaucusSpeakerTimer = 0; store.sync()">🗑️ 清空名單</button>
            <div class="dual-timer"><span>總時長: {{ formatTime(store.modCaucusTotalTimer) }}</span><span>當前: {{ formatTime(store.modCaucusSpeakerTimer) }}</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 投票彈窗 Modal -->
    <div class="vote-modal-overlay" v-if="showVoteModal" @click.self="showVoteModal = false">
      <div class="vote-modal">
        <h3>為 <strong>{{ votingTargetCountry }}</strong> 投票 ({{ store.votingRound2 ? '第二輪' : '第一輪' }})</h3>
        <div class="vote-options">
          <button class="btn btn-success" @click="setVote('yes')">✅ 贊成</button>
          <button class="btn btn-success" @click="setVote('yes_speak')" v-if="!store.votingRound2">🗣️ 贊成並發言</button>
          <button class="btn btn-danger" @click="setVote('no')">❌ 反對</button>
          <button class="btn btn-danger" @click="setVote('no_speak')" v-if="!store.votingRound2">🗣️ 反對並發言</button>
          <button class="btn btn-secondary" @click="setVote('abstain')" v-if="!store.votingRound2">⚪ 棄權</button>
          <button class="btn btn-secondary" @click="setVote('abstain_speak')" v-if="!store.votingRound2 && store.ruleset === 'ecosoc'">🗣️ 棄權並發言</button>
          <button class="btn btn-warning" @click="setVote('pass')" v-if="!store.votingRound2">⏭️ 跳過</button>
        </div>
      </div>
    </div>

    <div class="live-clock">🕒 {{ currentTime }}</div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useConferenceStore } from '../stores/conference'

const route = useRoute()
const router = useRouter()
const store = useConferenceStore()
const confId = route.params.id
const selCountry = ref(''); const yieldTarget = ref(''); const mType = ref(''); const mCountry = ref(''); const mDetails = ref({})
const modSelCountry = ref(''); const timeLimitInput = ref(60); const docType = ref('WD'); const docNumber = ref(''); const docTitle = ref('')
const amendSelCountry = ref(''); const amendTimeInput = ref(60)
const currentTime = ref('')
const showVoteModal = ref(false); const votingTargetCountry = ref('')
const docFile = ref(null); const docFileInput = ref(null); const docUploading = ref(false)
const aTarget = ref(''); const aSponsor = ref(''); const aClause = ref(''); const aAction = ref('修改'); const aChange = ref('')
const speechNoteText = ref('')
const showMoreMenu = ref(false)
let clockInterval = null

const activeSpeaker = computed(() => store.currentModSpeaker || store.currentGeneralSpeaker || '')
const sortedMiniStats = computed(() => Object.entries(store.stats)
  .map(([name, v]) => ({ name, speeches: v.speeches, motionsPassed: v.motionsPassed || 0 }))
  .sort((a, b) => b.speeches - a.speeches))
const targetableDocs = computed(() => store.documents.filter(d => d.type === 'DR' && d.status === 'approved'))
const votingDoc = computed(() => store.documents.find(d => d.id === store.currentVotingDocId) || null)
// 可介紹的文件：潛在決議草案 / 尚未表決通過的修正案（皆須已審核）
const introDrDocs = computed(() => store.documents.filter(d => d.type === 'DR' && d.status === 'approved' && d.stage !== 'formal'))
const introAmendDocs = computed(() => store.documents.filter(d => d.type === 'A' && d.status === 'approved' && d.voteStatus !== 'passed'))
const canSubmitMotion = computed(() => {
  if (!mType.value || !mCountry.value) return false
  if (mType.value === '介紹決議草案' || mType.value === '介紹修正案') return !!mDetails.value.docId
  return true
})
// 下拉選單只列出尚未加入名單的國家，選過的自然消失，不用在一長串裡找誰已經登記過
const generalAvailableDelegates = computed(() => store.delegates.filter(d => !store.generalList.some(s => s.country === d.name)))
// 讓渡對象不能是自己
const yieldableDelegates = computed(() => store.delegates.filter(d => d.name !== store.currentGeneralSpeaker))
const modAvailableDelegates = computed(() => store.delegates.filter(d => !store.modCaucusList.some(s => s.country === d.name)))
const amendAvailableDelegates = computed(() => store.delegates.filter(d => !store.amendSpeakers.some(s => s.country === d.name)))
const canSubmitDoc = computed(() => {
  if (!docType.value || !docNumber.value || !docTitle.value) return false
  if (docType.value === 'A') return !!(aTarget.value && aClause.value.trim() && aChange.value.trim())
  return !!docFile.value
})

function docLabel(docId) {
  const d = store.documents.find(x => x.id === docId)
  return d ? `[${d.type} ${d.number}] ${d.title}` : '（找不到目標草案）'
}
function canIntroduce(doc) {
  if (doc.status !== 'approved' || store.screenMode === 'doc_voting') return false
  if (doc.type === 'A') return doc.voteStatus !== 'passed'
  if (doc.type === 'DR') return doc.stage !== 'formal'
  return false
}
function onDocFileChange(e) { docFile.value = e.target.files[0] || null }
async function submitDocUpload() {
  docUploading.value = true
  const extra = docType.value === 'A'
    ? { targetDocId: aTarget.value, sponsor: aSponsor.value, clause: aClause.value.trim(), actionType: aAction.value, changeText: aChange.value.trim() }
    : {}
  await store.uploadDocument(docType.value, docNumber.value, docTitle.value, docFile.value, extra)
  docUploading.value = false
  docNumber.value = ''; docTitle.value = ''; docFile.value = null
  aTarget.value = ''; aSponsor.value = ''; aClause.value = ''; aAction.value = '修改'; aChange.value = ''
  if (docFileInput.value) docFileInput.value.value = ''
}
function submitSpeechNote() {
  if (!speechNoteText.value || !activeSpeaker.value) return
  const phase = store.currentModSpeaker ? '有主持核心磋商' : '常規發言'
  store.addSpeechNote(activeSpeaker.value, phase, speechNoteText.value)
  speechNoteText.value = ''
}

function formatTime(sec) { const m = Math.floor((sec || 0) / 60); const s = (sec || 0) % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` }
function handleLogout() { const { auth, authMethods } = window.firebase; authMethods.signOut(auth).then(() => { router.push('/login') }) }
function openScreenView() { const r = router.resolve('/screen/' + confId); window.open(r.href, '_blank') }
function openDocsView() { const r = router.resolve('/docs/' + confId); window.open(r.href, '_blank') }
async function clearStats() { if (!confirm('⚠️ 確定要清除統計？')) return; try { await store.clearStats(); alert('✅ 已清除') } catch(e) { alert('❌ 失敗') } }
function handleResetVoting() { if (!confirm('⚠️ 確定要清空目前所有已投的票，重新開始這次唱名表決嗎？')) return; store.resetVoting() }
function openVoteModal(country) { votingTargetCountry.value = country; showVoteModal.value = true }
function setVote(voteType) { store.recordRollCallVote(votingTargetCountry.value, voteType); showVoteModal.value = false }
function getVoteLabel(vote) { return { yes:'✅ 贊成', yes_speak:'🗣️ 贊成並發言', no:'❌ 反對', no_speak:'🗣️ 反對並發言', abstain:'⚪ 棄權', abstain_speak:'🗣️ 棄權並發言', pass:'⏭️ 跳過' }[vote] || '' }
function handleSaveProgress() { store.saveProgress(); alert('✅ 會議進度已儲存 (已同步至雲端)') }

watch(() => store.title, (t) => { document.title = t ? t + ' - 主席控制台' : 'MUN 主席控制台' })

onMounted(() => {
  store.loadConference(confId)
  const updateClock = () => { currentTime.value = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false }) }; updateClock(); clockInterval = setInterval(updateClock, 1000)
})
onUnmounted(() => { if (clockInterval) clearInterval(clockInterval) })
</script>

<style scoped>
.chair-container { padding: 24px; padding-bottom: 60px; min-height: 100vh; position: relative; }

.page-header { margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
.header-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.header-title { display: flex; align-items: center; gap: 12px; }
.header-title h1 { font-size: 1.4rem; }
.header-icons { display: flex; gap: 6px; }

.toolbar { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 10px 14px; gap: 8px; }
.agenda-select { min-width: 160px; }
.toolbar-spacer { flex: 1; }
.row-actions { display: flex; gap: 6px; margin-left: auto; }

.more-menu { position: relative; }
.menu-overlay { position: fixed; inset: 0; z-index: 10; }
.menu-panel {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 20;
  background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md);
  box-shadow: var(--shadow-md); min-width: 180px; padding: 6px; display: flex; flex-direction: column; gap: 2px;
}
.menu-item {
  display: block; width: 100%; text-align: left; padding: 8px 10px; border: none; background: none;
  border-radius: var(--radius-sm); font-size: 14px; color: var(--color-text); cursor: pointer;
}
.menu-item:hover { background: #f4f4f5; }
.menu-item-danger { color: var(--color-danger); }
.menu-item-danger:hover { background: var(--color-danger-soft); }

.muted-text { color: var(--color-text-secondary); font-size: 0.9rem; }

.grid-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.column .card { margin-bottom: 20px; }
h3 { font-size: 1rem; margin: 0 0 14px 0; padding-bottom: 10px; border-bottom: 1px solid var(--color-border); }

.input-row { display: flex; gap: 10px; margin-bottom: 10px; align-items: center; }
.input-row input, .input-row select { flex: 1; }
.field-label { font-size: 0.85rem; color: var(--color-text-secondary); white-space: nowrap; }
.list-scroll { max-height: 150px; overflow-y: auto; margin-bottom: 10px; }
.list-item { padding: 8px 10px; background: var(--color-bg); margin-bottom: 5px; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 8px; }
.list-item > span:first-child { flex: 1; }
.mod-item { background: var(--color-accent-soft); }
.remove-btn { padding: 2px 8px; color: var(--color-text-muted); line-height: 1; }
.remove-btn:hover { color: var(--color-danger); }
.empty { text-align: center; color: var(--color-text-muted); padding: 14px; font-size: 0.9rem; }
.timer-control-row { display: flex; align-items: center; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
.yield-select { flex: 1; }

.current-speaker-box { background: var(--color-accent-soft); padding: 12px 14px; border-radius: var(--radius-md); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
.timer-display { font-family: ui-monospace, monospace; font-weight: 700; color: var(--color-danger); font-size: 1.2rem; }

.roll-call-control { border-color: var(--color-accent-border); }
.rc-status { text-align: center; margin-bottom: 10px; font-weight: 600; color: var(--color-text-secondary); font-size: 0.9rem; }
.roll-call-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; max-height: 200px; overflow-y: auto; padding: 2px; margin-bottom: 12px; }
.roll-call-item { background: var(--color-bg); padding: 8px; border-radius: var(--radius-sm); display: flex; flex-direction: column; gap: 4px; }
.rc-name { font-size: 0.85rem; font-weight: 600; text-align: center; }
.rc-buttons { display: flex; gap: 4px; flex-wrap: wrap; }
.rc-btn { flex: 1; padding: 3px 0; font-size: 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); cursor: pointer; min-width: 40px; }
.rc-btn.active-present { background: var(--color-success); color: white; border-color: var(--color-success); }
.rc-btn.active-late { background: var(--color-warning); color: white; border-color: var(--color-warning); }
.rc-btn.active-absent { background: var(--color-danger); color: white; border-color: var(--color-danger); }
.rc-btn-change-late { background: var(--color-warning-soft); color: var(--color-warning); border: none; padding: 3px 6px; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.7rem; }

.mod-info-badge { background: var(--color-accent-soft); padding: 10px; border-radius: var(--radius-md); margin-bottom: 12px; text-align: center; font-size: 0.9rem; }
.dual-timer { display: flex; flex-direction: column; font-family: ui-monospace, monospace; font-size: 0.85rem; color: var(--color-text-secondary); margin-left: auto; }

.voting-controls-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--color-border); flex-wrap: wrap; gap: 8px; }
.delegates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; max-height: 320px; overflow-y: auto; }
.delegate-row { display: flex; flex-direction: column; gap: 6px; background: var(--color-bg); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--color-border); }
.delegate-row.voted { background: var(--color-success-soft); border-color: var(--color-success-border); }
.d-name { font-weight: 600; font-size: 0.9rem; }
.d-actions { display: flex; gap: 4px; }

.consensus-controls { display: flex; gap: 10px; margin-top: 10px; }
.consensus-result-box { text-align: center; padding: 10px 0; }
.consensus-result-box p { font-size: 1rem; margin-bottom: 15px; }

.doc-vote-summary { background: var(--color-bg); border-radius: var(--radius-md); padding: 14px; margin-bottom: 12px; }
.doc-vote-title { font-weight: 600; margin-bottom: 10px; }
.doc-vote-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 0.9rem; }
.doc-vote-change { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 10px; margin: 10px 0 0 0; font-size: 0.9rem; white-space: pre-wrap; }
.cancel-doc-vote { margin-top: 8px; }
.amend-textarea { width: 100%; margin-bottom: 10px; resize: vertical; font-family: inherit; }
.action-select { flex: 0 0 110px; }
.form-hint { font-size: 0.8rem; margin: -4px 0 10px 0; }
.amend-summary { font-size: 0.8rem; margin-top: 6px; }

.queue-list { max-height: 160px; overflow-y: auto; margin: 10px 0; display: flex; flex-direction: column; gap: 6px; }
.queue-item { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: var(--color-warning-soft); border-radius: var(--radius-sm); }

.doc-review-list { max-height: 220px; overflow-y: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.doc-review-item { padding: 10px; background: var(--color-bg); border-radius: var(--radius-md); border-left: 3px solid var(--color-border-strong); }
.doc-review-item.pending { border-left-color: var(--color-warning); }
.doc-review-item.approved { border-left-color: var(--color-success); }
.doc-review-item.rejected { border-left-color: var(--color-danger); opacity: 0.7; }
.doc-review-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.doc-link { color: var(--color-accent); text-decoration: none; font-size: 0.85rem; margin-left: auto; }
.doc-review-actions, .row-actions { display: flex; gap: 6px; margin-top: 8px; }

.active-speaker-tag { white-space: nowrap; }
.speech-notes-list { max-height: 220px; overflow-y: auto; margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.speech-note-item { position: relative; background: var(--color-bg); padding: 10px 30px 10px 10px; border-radius: var(--radius-md); }
.speech-note-head { display: flex; gap: 10px; align-items: baseline; margin-bottom: 4px; }
.note-text { margin: 0; font-size: 0.9rem; white-space: pre-wrap; }
.btn-delete-note { position: absolute; top: 8px; right: 8px; background: none; border: none; cursor: pointer; opacity: 0.5; }
.btn-delete-note:hover { opacity: 1; }

.mini-stats-list { max-height: 220px; overflow-y: auto; }
.mini-stats-row { display: flex; align-items: center; gap: 15px; padding: 8px 4px; border-bottom: 1px solid var(--color-border); }
.mini-stats-name { font-weight: 600; flex: 1; }
.mini-stats-val { font-size: 0.85rem; color: var(--color-text-secondary); }

.vote-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15,23,42,0.45); display: flex; justify-content: center; align-items: center; z-index: 2000; }
.vote-modal { background: var(--color-surface); padding: 24px; border-radius: var(--radius-lg); width: 300px; box-shadow: var(--shadow-lg); }
.vote-modal h3 { text-align: center; border: none; padding: 0; margin-bottom: 16px; }
.vote-options { display: flex; flex-direction: column; gap: 8px; }

.live-clock { position: fixed; bottom: 16px; right: 20px; background: var(--color-text); color: #f4f4f5; padding: 8px 16px; border-radius: var(--radius-md); font-family: ui-monospace, monospace; font-size: 13px; z-index: 1000; }
</style>
