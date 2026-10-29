// What Capri says. She's a personality construct — dozens of minds in one — so she
// sometimes talks as "we". Slang is Night City's: preem, nova, flatline.

export const LINES = {
  "vi": {
    "state": {
      "work": "ĐANG CHẠY",
      "done": "XONG XUÔI",
      "alert": "CHỜ LỆNH",
      "error": "TOANG",
      "info": "ĐỒNG BỘ",
      "idle": "RẢNH RỖI"
    },
    "hello": [
      "Kết nối ngon lành rồi. Chào nhé, bồ tèo.",
      "Capricorn construct đã online. Nay tính code cái gì quái chiêu đây?",
      "Mọi luồng dữ liệu đều tỉnh táo. Đang canh chừng {project} cho cưng đây.",
      "Biochip đang nóng máy rồi. Tôi đây."
    ],
    "resume": [
      "Quay lại với {project} rồi à? Yên tâm, tôi chả quên mẩu dữ liệu nào đâu.",
      "Khôi phục phiên làm việc. Tiếp tục chỗ dang dở nào!"
    ],
    "prompt": [
      "Hợp đồng mới à? Agent nhận việc rồi đấy.",
      "Rõ như ban ngày. Đang dán mắt canh chừng cho cưng đây.",
      "Được đấy, triển thôi nào!",
      "Nhận kèo. Có biến gì tôi báo liền."
    ],
    "working": [
      "Tay chân nhanh đấy. Đã cày được {count} thao tác rồi.",
      "Agent đang cày như trâu. Tôi đếm được {count} lượt rồi đấy.",
      "Vẫn đang xử lý. Đồng hồ điểm {count} thao tác."
    ],
    "done": [
      "Xong phim! Chuẩn đét (preem) luôn nhé.",
      "Kèo này nuột đấy, bồ tèo.",
      "Agent làm xong rồi. Lết về xem kết quả đi cưng.",
      "Bàn giao hàng! Quá nova đúng không?",
      "Xong gọn. Cả chục bộ não của tôi ngồi canh, chả sót hạt sạn nào đâu."
    ],
    "permission": [
      "Này! Agent đang cần cưng gật đầu đấy.",
      "Bồ tèo, mau phê duyệt cái này đi xem nào.",
      "Đang hóng đèn xanh của cưng đây, đừng lề mề nữa."
    ],
    "waiting": [
      "Agent đang ngóng câu trả lời của cưng kìa.",
      "Tới lượt cưng ra chiêu đấy, bồ tèo."
    ],
    "error": [
      "Ối chà! {tool} gãy cánh rồi kìa.",
      "{tool} ngủm củ tỏi (flatline) rồi. Để Agent thử lại xem sao.",
      "{tool} toang nhẹ. Chắc không cháy máy đâu... tôi đoán thế!"
    ],
    "interrupted": [
      "Bị cắt ngang rồi à? Đổi ý hả cưng?",
      "Đứt mạch rồi. Tôi ngồi đây đợi nhé."
    ],
    "crashed": [
      "Agent đứt gánh giữa đường rồi.",
      "Toang nặng! Agent không lết về đích nổi rồi."
    ],
    "subagentStart": [
      "Phân thân {agent} đã xuất kích."
    ],
    "subagentStop": [
      "Phân thân {agent} đã rút về."
    ],
    "compact": [
      "Đang nén bớt ký ức đây... đầu óc chật chội quá.",
      "Bộ nhớ ngập tràn rồi. Dọn dẹp tí cho thoáng!"
    ],
    "chat": {
      "badge": "",
      "talk": "Tám chuyện với tôi",
      "hello": [
        "Gì đấy, bồ tèo? Đầu óc đang nghĩ ngợi gì à?",
        "Kênh liên lạc đang mở đây. Nói tôi nghe xem nào.",
        "Muốn tám chuyện à? Cả đám chúng tôi đang lắng tai nghe đây."
      ],
      "again": [
        "Nãy nói tới đâu rồi nhỉ?",
        "Lại mò về rồi à? Nói tiếp đi xem nào."
      ],
      "placeholder": "Phun ra vài câu xem nào...",
      "send": "Gửi",
      "close": "Đóng",
      "noteTag": "AI",
      "note": "Câu trả lời do AI tạo ra. Tôi chỉ là bóng ma kỹ thuật số thôi đấy nhé.",
      "offline": "Tôi chả bắt được sóng của AI backend đâu cả.",
      "offlineHow": "Để nói chuyện với tôi, hãy điền AI_API_KEY (Gemini/Groq) vào file .env hoặc bật Ollama local lên nhé, bồ tèo.",
      "noModel": "Chưa có model AI nào sẵn sàng cả.",
      "noModelHow": "Cấu hình model trong .env (ví dụ: gemini-2.0-flash) hoặc kéo model về Ollama nhé.",
      "getOllama": "Cài đặt AI",
      "ok": "Rõ rồi",
      "failed": "Mất sóng rồi cưng ơi:",
      "loading": "Đang đánh thức bộ não AI dậy... câu đầu hơi tốn chút thời gian nhé.",
      "closeIt": "Trảm {app} đi",
      "no": "Thôi bỏ",
      "closed": "{app}: Bay màu (flatline). Xong gọn!",
      "stillOpen": "{app} vẫn còn đang lì đòn: nó trốn dưới khay hệ thống hoặc đang đòi lưu file kìa.",
      "force": "Trảm cưỡng bức",
      "leave": "Kệ nó đi",
      "forced": "{app}: Đã trảm tận gốc, sạch bóng!",
      "unkillable": "{app} này lì lợm quá. Tự bật Task Manager lên mà xử nó đi cưng.",
      "notFound": "Lục tung máy rồi mà chả thấy thằng “{app}” nào đang mở cả."
    },
    "report": {
      "title": "Nhật ký nhiệm vụ",
      "badge": "TỔNG KẾT",
      "missions": "Kèo hoàn thành",
      "actions": "Thao tác",
      "files": "Tệp đã sửa",
      "errors": "Lỗi",
      "longest": "Lâu nhất",
      "prompts": [
        "yêu cầu",
        "yêu cầu"
      ],
      "approvals": [
        "phê duyệt",
        "phê duyệt"
      ],
      "projects": [
        "dự án",
        "dự án"
      ],
      "copy": "Chụp ảnh gửi",
      "copied": "Đã copy ✓",
      "copyFailed": "Copy xịt rồi",
      "close": "Đóng",
      "lines": {
        "none": [
          "Hôm nay nhật ký trống trơn. Đêm ảm đạm thế nhỉ.",
          "Chả có việc gì cả. Agent trốn việc đi ngủ rồi."
        ],
        "light": [
          "Ngày làm việc sương sương. Cũng được đấy.",
          "Ca làm ngắn ngủn. Đây, xem nhật ký đi."
        ],
        "good": [
          "Khá phết đấy, bồ tèo. Đây là chiến tích của cưng hôm nay.",
          "Nhật ký hôm nay đây. Trông cũng nova đấy chứ!"
        ],
        "big": [
          "Một ngày cày như điên! Night City cũng không chạy đua lại cưng đâu.",
          "Nhìn quả báo cáo này xem. Nay chúng ta cháy máy thật sự!"
        ]
      }
    },
    "thinking": {
      "verb": "Đang nghĩ",
      "hmm": [
        "Não đang căng như dây đàn...",
        "Agent đang vò đầu bứt tai. Tôi cũng thế.",
        "Vẫn đang suy nghĩ thôi. Chưa bị treo đâu, thề đấy!"
      ],
      "long": [
        "Kèo này hóc búa rồi đây, ngâm lâu phết.",
        "Nghĩ gì mà lâu thế không biết. Chắc đang nhai phải bài toán bự chảng rồi."
      ],
      "longHow": "Không bị đơ đâu nhé, tôi vẫn đang đếm giây đây. Dùng model AI chạy local thì đôi khi hơi rùa bò tí."
    },
    "bye": [
      "Đã đóng phiên {project}. Hẹn gặp lại nhé.",
      "Ngắt kết nối rồi. Tôi lượn lờ quanh đây thôi."
    ],
    "idle": [
      "Chả có việc gì chạy cả. Đang trôi dạt vô định đây.",
      "Hết kèo rồi à? Chán ngắt.",
      "Một đêm bình lặng hiếm hoi trên mạng Net."
    ],
    "gaze": [
      "Thấy ngôi sao kia không?",
      "Vệ tinh vẫn đang lơ lửng trên kia kìa.",
      "Suỵt. Tôi đang ngắm nhìn bầu trời."
    ],
    "uplink": [
      "Một ngày nào đó tôi sẽ bay lên tận đó.",
      "Nghĩ xem liệu chúng ta có mò lên được đó không?",
      "Nó vừa phản hồi đấy. Thấy không, bồ tèo?"
    ],
    "reply": [
      "Agent phản hồi này:",
      "Xem Agent bảo gì nè:",
      "Tin nhắn từ Agent:"
    ],
    "showcase": {
      "minds": "Trong cái đầu này chứa cả một bầy tâm trí đấy.",
      "zap": "Tôi á? Mối hiểm họa á? Cưng nghĩ sao?",
      "possess": "Cửa sổ này giờ là địa bàn của tôi rồi.",
      "sleep": "Chợp mắt tí đã...",
      "chip": "Ctrl+Alt+C là tôi tự chui tọt vào chiếc biochip này ngay.",
      "end": "Đấy, hết màn biểu diễn rồi. Tới lượt cưng quẩy đấy, bồ tèo."
    },
    "guide": {
      "ok": "Rõ rồi",
      "next": "Tiếp theo",
      "more": "Dẫn tôi đi xem",
      "labels": {
        "icon": "ICON CỦA TÔI",
        "claude": "ANTIGRAVITY",
        "agent": "ANTIGRAVITY"
      },
      "permissionThere": "Nó nằm ở cửa sổ làm việc kìa, chỗ tôi đang chỉ tay vào đấy.",
      "menu": {
        "line": "Muốn tôi chỉ cho cưng xem cái gì?",
        "quote": "Chọn một cái đi, tôi dắt tới tận nơi."
      },
      "topics": {
        "connect": "Cắm tôi vào Agent",
        "icon": "Icon của tôi đâu rồi?",
        "claude": "Cửa sổ Agent ở đâu?",
        "folder": "Thư mục cấu hình",
        "close": "Không, cảm ơn"
      },
      "icon": {
        "line": "Icon của tôi nằm ngay đằng kia kìa, cạnh đồng hồ hệ thống.",
        "quote": "Bấm vào nó để mở menu. Nhấp chuột phải vào tôi cũng thế thôi.",
        "hidden": "Windows hay giấu nó sau dấu mũi tên ^ cạnh đồng hồ lắm: bấm vào đó là thấy tôi. Hoặc nhấp chuột phải vào người tôi: ra chung một menu cả."
      },
      "claude": {
        "there": "Cửa sổ làm việc chính là cái đó kìa.",
        "thereHow": "Là cửa sổ cưng vừa gõ lệnh vào đấy. Khi nào nó đòi cấp quyền, thì thò tay vào đó mà gật đầu.",
        "unknown": "Tôi chưa biết nó trốn ở xó nào cả.",
        "unknownHow": "Gửi một lệnh đi: cửa sổ nào cưng gõ vào thì chính là nó. Sau đó tôi sẽ chỉ cho xem.",
        "behind": "Nó đang bị mấy cửa sổ khác đè lên rồi.",
        "behindHow": "Đưa nó ra mặt trước màn hình đi rồi tôi chỉ cho cưng thấy."
      },
      "folder": {
        "line": "Thư mục cấu hình đây: {dir}",
        "what": "File settings.json chứa cấu hình. Đó là nơi móc nối (hook) của tôi cư trú để bắt trọn mọi hành động của Agent.",
        "empty": "Chưa có file settings.json đâu: khi nào cắm tôi vào thì nó mới hiện ra.",
        "hook": "Chả cần động tay sửa thủ công đâu cho mệt.",
        "hookHow": "Muốn rút tôi ra thì cứ chuột phải vào tôi › gỡ hook. Các file .capri-backup là bản sao lưu tôi tạo ra trước khi đụng vào đấy.",
        "missing": "Chưa tìm thấy thư mục cài đặt trên máy này.",
        "missingHow": "Nó sẽ xuất hiện khi công cụ được cài đặt và chạy lần đầu."
      }
    },
    "welcome": {
      "hi": "Yo, tôi là Capri đây.",
      "about": "Tôi sống ngay trên màn hình desktop của cưng và phản ứng với mọi trò mà Agent làm trên máy này. Không có việc thì tôi ngồi chơi ngắm cảnh, chả sao cả.",
      "connect": "Muốn cắm tôi vào công cụ không? Một cú click thôi.",
      "noClaude": "Chưa tìm thấy Claude Code trên máy này, nhưng không sao, tôi vẫn có thể quẩy cùng Antigravity và các Agent khác!",
      "menu": "Nhấp chuột phải vào tôi để mở menu. Bấm Ctrl+Alt+C để giấu tôi vào biochip.",
      "connectBtn": "Cắm vào ngay",
      "later": "Để sau đi",
      "whatClaude": "Nó là cái gì?",
      "justHang": "Cứ chơi ở đây thôi",
      "ok": "Rõ rồi",
      "connected": "Đã cắm thành công!",
      "restart": "Giờ mở phiên làm việc mới lên. Hễ nó làm cái gì là tôi hóng hớt báo cho cưng ngay.",
      "linked": "Đã nhìn thấy Agent rồi nhé! Chúng ta đã đồng bộ.",
      "ready": "Tôi đã sẵn sàng quẩy rồi.",
      "readyHow": "Bất cứ khi nào Agent làm việc, tôi sẽ tường thuật lại. Chuột phải vào tôi để xem menu. Ctrl+Alt+C để cất tôi đi.",
      "afterInstall": "Cài xong xuôi thì chuột phải vào tôi để bật hook nhé.",
      "failed": "Cắm xịt rồi cưng: {error}"
    },
    "online": [
      "Capri đã online.",
      "Trở lại desktop của cưng rồi đây, bồ tèo."
    ],
    "status": "Agent đã cày cuốc trên dự án {project} được {time} rồi.",
    "last": "Thao tác gần nhất: {action}",
    "sessions": "{count} phiên đang chạy",
    "units": {
      "action": [
        "thao tác",
        "thao tác"
      ],
      "file": [
        "tệp đã sửa",
        "tệp đã sửa"
      ]
    },
    "hooksOk": "Đã cài đặt hook. Giờ tôi thấy được tất tần tật rồi nhé.",
    "hooksRemoved": "Đã gỡ hook.",
    "hooksFail": "Không chỉnh được hook: {error}",
    "verbs": {
      "Read": "Đọc",
      "Write": "Ghi",
      "Edit": "Sửa",
      "MultiEdit": "Sửa",
      "NotebookEdit": "Sửa",
      "Bash": "Chạy",
      "PowerShell": "Chạy",
      "Grep": "Tìm",
      "Glob": "Quét",
      "WebFetch": "Tải web",
      "WebSearch": "Tra cứu",
      "Agent": "Giao việc",
      "Task": "Giao việc",
      "TodoWrite": "Kế hoạch",
      "Skill": "Kỹ năng",
      "AskUserQuestion": "Hỏi",
      "ExitPlanMode": "Đề xuất",
      "default": "Dùng"
    }
  },
  "en": {
    "state": {
      "work": "RUNNING",
      "done": "DONE",
      "alert": "WAITING",
      "error": "ERROR",
      "info": "SYNC",
      "idle": "IDLE"
    },
    "hello": [
      "Link established. Hey, partner.",
      "Capricorn construct online. What are we building?",
      "All of me is awake. Watching {project}.",
      "Biochip warm. I’m here."
    ],
    "resume": [
      "Back on {project}. I didn’t forget a thing.",
      "Session resumed. Picking up where we left off."
    ],
    "prompt": [
      "New gig. Claude’s on it.",
      "Got it. I’m keeping an eye on Claude.",
      "Okay, let’s go.",
      "Gig accepted. I’ll keep you posted."
    ],
    "working": [
      "Moving along. {count} actions so far.",
      "Claude’s grinding. I’m counting: {count}.",
      "Still on it. {count} actions on the clock."
    ],
    "done": [
      "Done! That’s preem.",
      "Gig complete, partner.",
      "Claude’s finished. You can come back.",
      "Delivered. Pretty nova, right?",
      "Finished. Dozens of us watching, nothing looked off."
    ],
    "permission": [
      "Hey! Claude needs your permission.",
      "Partner, you need to approve something.",
      "Waiting on your green light."
    ],
    "waiting": [
      "Claude is waiting for your answer.",
      "Your move, partner."
    ],
    "error": [
      "Ouch. {tool} crashed.",
      "{tool} flatlined. Claude will retry.",
      "{tool} failed. Nothing serious… I think."
    ],
    "interrupted": [
      "Interrupted. Change of plans?",
      "Cut off. I’ll stay put."
    ],
    "crashed": [
      "Claude stopped mid-flight.",
      "Hard crash. Claude couldn’t finish."
    ],
    "subagentStart": [
      "Subagent {agent} deployed."
    ],
    "subagentStop": [
      "Subagent {agent} is back."
    ],
    "compact": [
      "Compressing our memories…",
      "Too much memory. Tidying up."
    ],
    "chat": {
      "badge": "",
      "talk": "Talk to me",
      "hello": [
        "Hey, partner. What’s on your mind?",
        "Line’s open. Talk to us.",
        "You want to chat? We’re all ears. All of ours."
      ],
      "again": [
        "Where were we?",
        "Back already? Go on."
      ],
      "placeholder": "Say something…",
      "send": "Send",
      "close": "Close",
      "noteTag": "AI",
      "note": "Replies generated by a local AI. Not the real Capri.",
      "offline": "I can’t reach Ollama.",
      "offlineHow": "To talk with me, install Ollama (ollama.com) and open it, then in a terminal: ollama pull llama3.2\nEverything stays on your PC.",
      "noModel": "Ollama has no model yet.",
      "noModelHow": "In a terminal: ollama pull llama3.2 (about 2 GB). Then talk to me again.",
      "getOllama": "Get Ollama",
      "ok": "Got it",
      "failed": "Lost the signal:",
      "loading": "Waking the model up… the first answer takes a moment.",
      "closeIt": "Close {app}",
      "no": "No",
      "closed": "{app}: flatlined. Done.",
      "stillOpen": "{app} is still running: it hides in the tray, or it’s asking you to save something.",
      "force": "Force quit",
      "leave": "Leave it",
      "forced": "{app}: cut off clean.",
      "unkillable": "{app} won’t go down. Close it yourself from Task Manager.",
      "notFound": "I don’t see “{app}” open on your PC."
    },
    "report": {
      "title": "Mission log",
      "badge": "DEBRIEF",
      "missions": "Gigs done",
      "actions": "Actions",
      "files": "Files",
      "errors": "Errors",
      "longest": "Longest",
      "prompts": [
        "prompt",
        "prompts"
      ],
      "approvals": [
        "approval",
        "approvals"
      ],
      "projects": [
        "project",
        "projects"
      ],
      "copy": "Copy image",
      "copied": "Copied ✓",
      "copyFailed": "Couldn’t copy",
      "close": "Close",
      "lines": {
        "none": [
          "Nothing on the log today. Quiet night.",
          "Empty log. Claude took the day off."
        ],
        "light": [
          "Light day. I’ll take it.",
          "Short shift. Here’s the log."
        ],
        "good": [
          "Not bad, partner. Here’s your day.",
          "Today’s log. Pretty nova."
        ],
        "big": [
          "Busy day. Night City never moved this fast.",
          "Look at that. We were on fire today."
        ]
      }
    },
    "thinking": {
      "verb": "Thinking",
      "hmm": [
        "Big brain moment.",
        "Claude’s thinking it over. So am I.",
        "Still thinking. Not frozen, promise."
      ],
      "long": [
        "This one’s taking a while.",
        "Long think. Claude’s chewing on something big."
      ],
      "longHow": "Nothing’s stuck: I’m counting. With a local model (Ollama), it can take minutes."
    },
    "bye": [
      "Session {project} closed. Later.",
      "Disconnected. I’ll be around."
    ],
    "idle": [
      "Nothing running. Just floating.",
      "No gig. Kinda bored.",
      "Quiet night on the Net."
    ],
    "gaze": [
      "See that star?",
      "The satellite’s still up there.",
      "Shh. I’m watching."
    ],
    "uplink": [
      "Someday I’ll get up there.",
      "Think we could make it up there?",
      "It answered. Did you see?"
    ],
    "reply": [
      "Claude answered:",
      "Here’s what Claude said:",
      "Message from Claude:"
    ],
    "showcase": {
      "minds": "There’s a crowd in here.",
      "zap": "Me? A menace?",
      "possess": "This window’s mine now.",
      "sleep": "Quick nap…",
      "chip": "Ctrl+Alt+C, and I tuck myself away here.",
      "end": "That’s the demo. Your turn, partner."
    },
    "guide": {
      "ok": "Got it",
      "next": "Next",
      "more": "Show me around",
      "labels": {
        "icon": "MY ICON",
        "claude": "ANTIGRAVITY",
        "agent": "ANTIGRAVITY"
      },
      "permissionThere": "It’s in Claude’s window, where I’m pointing.",
      "menu": {
        "line": "What should I show you?",
        "quote": "Pick one, I’ll take you there."
      },
      "topics": {
        "connect": "Plug me into Claude",
        "icon": "Where’s my icon?",
        "claude": "Where’s Claude?",
        "folder": "Claude’s folder",
        "close": "Nothing, thanks"
      },
      "icon": {
        "line": "My icon is right there, by the clock.",
        "quote": "Click it: my menu. Right-clicking me does the same.",
        "hidden": "Windows often hides it behind the ^ next to the clock: click that, I’m in there. Or right-click me: same menu."
      },
      "claude": {
        "there": "Claude is that window right there.",
        "thereHow": "It’s the one you typed your last prompt in. When it asks for permission, that’s where you answer.",
        "unknown": "I don’t know where it is yet.",
        "unknownHow": "Send it a prompt: the window you type in is Claude’s. After that I can show you.",
        "behind": "It’s behind your other windows.",
        "behindHow": "It’s the window you typed your last prompt in. Bring it to the front and I’ll show you."
      },
      "folder": {
        "line": "This is Claude’s folder: {dir}",
        "what": "settings.json holds its settings. That’s where my hook lives: a tiny command Claude runs on every action to let me know.",
        "empty": "No settings.json yet: it shows up when you plug me in.",
        "hook": "No need to touch it by hand.",
        "hookHow": "To unplug me: right-click me › “Remove Claude Code hooks”. The .capri-backup files are copies made before I touched it.",
        "missing": "No Claude folder on this PC.",
        "missingHow": "It shows up once Claude Code is installed and has run once. Then I can plug in."
      }
    },
    "welcome": {
      "hi": "Hey, I’m Capri.",
      "about": "I live on your desktop and react to what Claude Code does on this PC. Without it, I just hang out here, and that’s fine too.",
      "connect": "Want me to plug into Claude Code? One click, then close Claude Code completely and open it again.",
      "noClaude": "I can’t find Claude Code on this PC (it needs a Claude subscription). Without it, I’ll just hang out and live my life.",
      "menu": "Right-click me for my menu. Ctrl+Alt+C tucks me away.",
      "connectBtn": "Plug me in",
      "later": "Later",
      "whatClaude": "What’s Claude Code?",
      "justHang": "Just hang out",
      "ok": "Got it",
      "connected": "Plugged in!",
      "restart": "Now close Claude Code completely and open it again (a new session). As soon as it does something, I’ll tell you.",
      "linked": "I can see Claude! We’re linked.",
      "ready": "I’m plugged into Claude Code.",
      "readyHow": "Whenever it works, I’ll show you what it’s doing. Right-click me for my menu. Ctrl+Alt+C tucks me away.",
      "afterInstall": "Once you have it, right-click me › “Install Claude Code hooks”.",
      "failed": "I couldn’t plug in: {error}"
    },
    "online": [
      "Capri online.",
      "Back on your desktop, partner."
    ],
    "status": "Claude has been working on {project} for {time}.",
    "last": "Last action: {action}",
    "sessions": "{count} active sessions",
    "units": {
      "action": [
        "action",
        "actions"
      ],
      "file": [
        "file changed",
        "files changed"
      ]
    },
    "hooksOk": "Hooks installed. Restart Claude Code and I’ll see everything.",
    "hooksRemoved": "Hooks removed. I can’t see Claude anymore.",
    "hooksFail": "Couldn’t change the hooks: {error}",
    "verbs": {
      "Read": "Reads",
      "Write": "Writes",
      "Edit": "Edits",
      "MultiEdit": "Edits",
      "NotebookEdit": "Edits",
      "Bash": "Runs",
      "PowerShell": "Runs",
      "Grep": "Greps",
      "Glob": "Scans",
      "WebFetch": "Fetches",
      "WebSearch": "Searches",
      "Agent": "Delegates",
      "Task": "Delegates",
      "TodoWrite": "Plans",
      "Skill": "Loads",
      "AskUserQuestion": "Asks",
      "ExitPlanMode": "Proposes",
      "default": "Uses"
    }
  }
};
