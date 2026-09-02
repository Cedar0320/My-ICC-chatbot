const express = require('express');
const crypto = require('crypto');
const config = require('../config/config');
const { getPracticeDetails } = require('../services/practiceService');
const OpenCC = require('opencc-js');

const router = express.Router();
const traditionalConverter = OpenCC.Converter({ from: 'cn', to: 'tw' });

function getSafetyIdentifier(userId) {
  const salt = config.jwt?.secret || 'commai-realtime';
  return crypto.createHash('sha256').update(`${salt}:${userId}`).digest('hex');
}


// Voice 2.0 v2：先由後端建立短效 client secret，再讓瀏覽器直接
// 與 OpenAI /v1/realtime/calls 建立 WebRTC。這樣不讓 CommAI server
// 代理整段 SDP/ICE 協商，可避免 server 成為 Realtime 初始化的關鍵路徑。
router.post('/client-secret', async (req, res) => {
  try {
    const { practiceId } = req.query;
    if (!practiceId) {
      return res.status(400).json({ success: false, error: 'practiceId 為必填' });
    }
    if (!config.openaiApiKey) {
      return res.status(500).json({ success: false, error: 'OpenAI API key 未設定' });
    }

    // 產生任何 Realtime 憑證前，先確認這筆練習屬於目前登入者。
    await getPracticeDetails(req.user.id, practiceId);

    const sessionConfig = {
      type: 'transcription',
      audio: {
        input: {
          transcription: {
            model: 'gpt-live-transcribe',
            languages: ['zh-tw'],
            delay: 'low',
            prompt: '台灣學校親師溝通練習。說話者是教師，內容常包含學生、家長、班級、作業、學習、行為與親師合作等詞彙。請使用繁體中文轉錄。'
          },
          // gpt-live-transcribe 不支援 server turn detection。
          // 由前端本地 VAD 判斷停頓後，透過 data channel 明確送出
          // input_audio_buffer.commit，符合官方 Realtime transcription 流程。
          turn_detection: null
        }
      }
    };

    const openaiResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.openaiApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Safety-Identifier': getSafetyIdentifier(req.user.id)
      },
      body: JSON.stringify({ session: sessionConfig })
    });

    const responseText = await openaiResponse.text();
    let data = null;
    try { data = JSON.parse(responseText); } catch (_) {}

    if (!openaiResponse.ok) {
      console.error('建立 Realtime client secret 失敗:', {
        status: openaiResponse.status,
        response: responseText.slice(0, 800)
      });
      return res.status(502).json({
        success: false,
        error: '無法建立 Realtime 短效憑證',
        upstreamStatus: openaiResponse.status,
        upstreamMessage: data?.error?.message || null
      });
    }

    if (!data?.value) {
      console.error('Realtime client secret 回應缺少 value:', responseText.slice(0, 800));
      return res.status(502).json({
        success: false,
        error: 'Realtime 短效憑證格式異常'
      });
    }

    res.json({
      success: true,
      value: data.value,
      expires_at: data.expires_at || null
    });
  } catch (error) {
    console.error('Realtime client secret 錯誤:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '建立 Realtime 短效憑證失敗'
    });
  }
});



// Voice 2.0：Realtime transcription 偶爾仍會回傳簡體中文。
// 這裡只做本地 OpenCC 文字正規化，不會呼叫 OpenAI，也不會增加 API 費用。
router.post('/normalize-transcript', async (req, res) => {
  try {
    const { practiceId, text } = req.body || {};
    if (!practiceId) {
      return res.status(400).json({ success: false, error: 'practiceId 為必填' });
    }
    if (typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text 為必填' });
    }

    // 避免讓這個工具型 endpoint 成為越權入口。
    await getPracticeDetails(req.user.id, practiceId);

    const normalized = traditionalConverter(text).trim();
    res.json({ success: true, text: normalized });
  } catch (error) {
    console.error('Realtime transcript 繁體化失敗:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || '轉換繁體中文失敗'
    });
  }
});

// Voice 2.0：瀏覽器以 WebRTC 傳入 SDP，後端用真正的 OpenAI API key
// 建立「只做即時轉錄」的 Realtime session。API key 永遠不會送到前端。
router.post(
  '/transcription-session',
  express.text({ type: ['application/sdp', 'text/plain'], limit: '1mb' }),
  async (req, res) => {
    try {
      const { practiceId } = req.query;
      if (!practiceId) {
        return res.status(400).json({ success: false, error: 'practiceId 為必填' });
      }
      if (!req.body || typeof req.body !== 'string') {
        return res.status(400).json({ success: false, error: '缺少 WebRTC SDP' });
      }
      if (!config.openaiApiKey) {
        return res.status(500).json({ success: false, error: 'OpenAI API key 未設定' });
      }

      // 產生付費 Realtime session 前先確認練習屬於目前登入者。
      await getPracticeDetails(req.user.id, practiceId);

      const sessionConfig = {
        type: 'transcription',
        audio: {
          input: {
            transcription: {
              model: 'gpt-live-transcribe',
              languages: ['zh-tw'],
              delay: 'low',
              prompt: '台灣學校親師溝通練習。說話者是教師，內容常包含學生、家長、班級、作業、學習、行為與親師合作等詞彙。請使用繁體中文轉錄。'
            },
            // gpt-live-transcribe 使用手動 commit；停頓判斷由瀏覽器本地完成。
            turn_detection: null
          }
        }
      };

      const form = new FormData();
      form.set('sdp', req.body);
      form.set('session', JSON.stringify(sessionConfig));

      const openaiResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          'OpenAI-Safety-Identifier': getSafetyIdentifier(req.user.id)
        },
        body: form
      });

      const responseText = await openaiResponse.text();
      if (!openaiResponse.ok) {
        console.error('建立 Realtime transcription session 失敗:', {
          status: openaiResponse.status,
          response: responseText.slice(0, 500)
        });
        return res.status(502).json({
          success: false,
          error: '無法建立即時語音連線',
          upstreamStatus: openaiResponse.status
        });
      }

      res.status(200).type('application/sdp').send(responseText);
    } catch (error) {
      console.error('Realtime transcription session 錯誤:', error.message);
      res.status(500).json({
        success: false,
        error: error.message || '建立即時語音連線失敗'
      });
    }
  }
);

module.exports = router;
