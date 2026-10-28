'use strict';

// Capri Assistant Tools: Real-time Date, Time and Weather
// Queries wttr.in for real-time weather and provides Cyberpunk in-character comments.

const WEATHER_DESC_VI = {
  clear: 'Trời quang đãng, trời trong',
  sunny: 'Trời nắng đẹp rạng rỡ',
  'partly cloudy': 'Có mây rải rác',
  cloudy: 'Nhiều mây',
  overcast: 'Trời âm u, nhiều mây mù',
  mist: 'Sương mù nhẹ',
  fog: 'Sương mù dày đặc',
  'freezing fog': 'Sương giá buốt',
  'patchy rain possible': 'Có thể có mưa vài nơi',
  'patchy snow possible': 'Có thể có tuyết vài nơi',
  'patchy sleet possible': 'Có thể có mưa tuyết',
  'patchy freezing drizzle possible': 'Có thể có mưa phùn băng giá',
  'thundery outbreaks possible': 'Có thể có dông sét',
  'blowing snow': 'Tuyết thổi mạnh',
  blizzard: 'Bão tuyết',
  'light drizzle': 'Mưa phùn nhẹ',
  'patchy light drizzle': 'Mưa phùn rải rác',
  'heavy drizzle': 'Mưa phùn nặng hạt',
  'patchy light rain': 'Mưa nhỏ ngắt quãng',
  'light rain': 'Mưa nhỏ',
  'moderate rain at times': 'Mưa rào từng đợt',
  'moderate rain': 'Mưa vừa',
  'heavy rain at times': 'Mưa to từng đợt',
  'heavy rain': 'Mưa to xối xả',
  'light freezing rain': 'Mưa băng nhẹ',
  'moderate or heavy freezing rain': 'Mưa băng dữ dội',
  'light sleet': 'Mưa tuyết nhẹ',
  'patchy light snow': 'Tuyết rơi nhẹ rải rác',
  'light snow': 'Tuyết rơi nhẹ',
  'patchy moderate snow': 'Tuyết vừa rải rác',
  'moderate snow': 'Tuyết rơi vừa',
  'patchy heavy snow': 'Tuyết dày từng đợt',
  'heavy snow': 'Tuyết rơi rất dày',
  'ice pellets': 'Mưa đá nhỏ',
  'light rain shower': 'Mưa rào nhẹ',
  'moderate or heavy rain shower': 'Mưa rào xối xả',
  'torrential rain shower': 'Mưa như trút nước',
  'light sleet showers': 'Mưa tuyết rải rác',
  'light showers of ice pellets': 'Mưa đá rải rác',
  'patchy light rain with thunder': 'Mưa nhỏ kèm sấm sét',
  'moderate or heavy rain with thunder': 'Dông sét bão bùng',
  'smoky haze': 'Mù mịt khói bụi sương khói',
  haze: 'Khói mù lãng đãng',
};

function translateWeather(desc) {
  const key = String(desc || '').toLowerCase().trim();
  if (WEATHER_DESC_VI[key]) return WEATHER_DESC_VI[key];
  for (const [k, v] of Object.entries(WEATHER_DESC_VI)) {
    if (key.includes(k)) return v;
  }
  return desc || 'Bình thường';
}

function getWeatherIcon(desc) {
  const d = String(desc || '').toLowerCase();
  if (d.includes('thunder') || d.includes('sét')) return '⛈️';
  if (d.includes('rain') || d.includes('mưa') || d.includes('drizzle')) return '🌧️';
  if (d.includes('snow') || d.includes('tuyết') || d.includes('ice')) return '❄️';
  if (d.includes('fog') || d.includes('mist') || d.includes('haze') || d.includes('sương')) return '🌫️';
  if (d.includes('cloud') || d.includes('mây') || d.includes('overcast')) return '⛅';
  if (d.includes('sun') || d.includes('clear') || d.includes('nắng')) return '☀️';
  return '🌡️';
}

function getTimeAndDate(lang = 'vi') {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const pad = (n) => String(n).padStart(2, '0');

  const timeStr = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

  const daysVi = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const isEn = lang === 'en';
  const dayOfWeek = (isEn ? daysEn : daysVi)[now.getDay()];

  let comment = '';
  if (isEn) {
    if (hours >= 0 && hours < 5) {
      comment = 'Late night in Night City, pal. Rest your eyes before your cyberware overheats!';
    } else if (hours >= 5 && hours < 11) {
      comment = 'Good morning netrunner! Coffee ready to hack the day?';
    } else if (hours >= 11 && hours < 14) {
      comment = 'Lunch time! Unplug from your cyberdeck and recharge your biochip.';
    } else if (hours >= 14 && hours < 18) {
      comment = 'Afternoon grind. Stay sharp so we can go wild tonight!';
    } else {
      comment = 'The neon lights of Night City are alive. Perfect time for synthwave!';
    }
  } else {
    if (hours >= 0 && hours < 5) {
      comment = 'Đêm khuya thanh vắng rồi đấy bồ tèo. Night City vẫn sáng đèn nhưng mắt cậu thì nên nghỉ ngơi kẻo cháy biochip!';
    } else if (hours >= 5 && hours < 11) {
      comment = 'Chào buổi sáng netrunner! Cà phê đã sẵn sàng để bẻ khóa ngày mới chưa?';
    } else if (hours >= 11 && hours < 14) {
      comment = 'Đã đến giờ nghỉ trưa rồi, tạm gác cyberdeck lại nạp chút calo đi bồ tèo!';
    } else if (hours >= 14 && hours < 18) {
      comment = 'Buổi chiều tăng tốc, tập trung cao độ để tối nay còn đi quẩy Night City nhé!';
    } else {
      comment = 'Màn đêm buông xuống rồi, đèn neon Night City đã rực sáng. Giờ này thưởng thức chút synth-wave là chuẩn bài nhất!';
    }
  }

  const text = isEn
    ? `Right now it is ${timeStr} (${dayOfWeek}, ${dateStr}). ${comment}`
    : `Bây giờ là ${timeStr} (${dayOfWeek}, ngày ${dateStr}). ${comment}`;

  return {
    ok: true,
    time: timeStr,
    date: dateStr,
    dayOfWeek,
    comment,
    text,
  };
}

async function getWeather(city = '', lang = 'vi') {
  try {
    let target = city ? encodeURIComponent(city.trim()) : '';
    let url = `https://wttr.in/${target}?format=j1`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    let res;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'curl/7.68.0',
          Accept: 'application/json',
        },
      });
    } catch {
      // Fallback to Ho Chi Minh City if empty query failed
      url = `https://wttr.in/Ho_Chi_Minh?format=j1`;
      res = await fetch(url, {
        headers: { 'User-Agent': 'curl/7.68.0', Accept: 'application/json' },
      });
    }
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }

    const data = await res.json();
    const current = data.current_condition?.[0] || {};
    const area = data.nearest_area?.[0] || {};

    const temp = parseInt(current.temp_C, 10) || 0;
    const feelsLike = parseInt(current.FeelsLikeC, 10) || temp;
    const humidity = current.humidity || 0;
    const windKmph = current.windspeedKmph || 0;
    const descEn = current.weatherDesc?.[0]?.value || 'Clear';
    const descVi = translateWeather(descEn);
    let areaName = area.areaName?.[0]?.value || (city || 'TP. Hồ Chí Minh');
    if (!city && (areaName.includes('An Phu') || areaName.includes('Ho Chi Minh') || areaName.includes('Saigon'))) {
      areaName = 'TP. Hồ Chí Minh';
    }
    const icon = getWeatherIcon(descEn);

    const isEn = lang === 'en';
    let comment = '';
    const lowerDesc = descEn.toLowerCase();
    if (isEn) {
      if (lowerDesc.includes('rain') || lowerDesc.includes('drizzle') || lowerDesc.includes('thunder')) {
        comment = 'Acid rain alert, pal! Don\'t forget your umbrella or armored coat.';
      } else if (temp >= 33) {
        comment = `Scorching ${temp}°C out there! Keep your CPU and cyberware cooled.`;
      } else if (temp <= 18) {
        comment = `Chilly ${temp}°C, wrap up warm when hitting the streets.`;
      } else {
        comment = 'Pleasant weather, ideal for netrunning and listening to tunes with me.';
      }
    } else {
      if (lowerDesc.includes('rain') || lowerDesc.includes('drizzle') || lowerDesc.includes('thunder')) {
        comment = 'Trời đang có mưa, cẩn thận mưa axit kiểu Night City đấy, nhớ cầm ô kẻo hỏng hết linh kiện điện tử!';
      } else if (temp >= 33) {
        comment = `Nhiệt độ lên tới ${temp}°C, nóng rực như lò phản ứng Arasaka, nhớ uống nước và hạ nhiệt CPU nhé bồ tèo!`;
      } else if (temp <= 18) {
        comment = `Trời lạnh ${temp}°C đấy, nhớ mặc áo khoác giáp giữ ấm khi lượn phố nhé!`;
      } else {
        comment = 'Thời tiết khá mát mẻ dễ chịu, cực kỳ lý tưởng để ngồi viết code hoặc nghe Lo-Fi cùng tôi!';
      }
    }

    const tickerCity = areaName === 'TP. Hồ Chí Minh' ? 'HCMC' : areaName;
    const ticker = `${icon} ${temp}°C · ${tickerCity}`;
    const desc = isEn ? descEn : descVi;
    const text = isEn
      ? `Weather in ${areaName}: ${temp}°C (feels like ${feelsLike}°C), ${desc}. Humidity: ${humidity}%, wind: ${windKmph} km/h. ${comment}`
      : `Thời tiết tại ${areaName}: ${temp}°C (cảm giác như ${feelsLike}°C), ${desc}. Độ ẩm: ${humidity}%, gió: ${windKmph} km/h. ${comment}`;

    return {
      ok: true,
      city: areaName,
      country: area.country?.[0]?.value || '',
      temp,
      feelsLike,
      humidity,
      windKmph,
      desc,
      descEn,
      icon,
      ticker,
      comment,
      text,
    };
  } catch (err) {
    console.warn('[assistant-tools] getWeather failed:', err.message);
    return {
      ok: false,
      error: `Không lấy được thông tin thời tiết: ${err.message}`,
    };
  }
}

module.exports = {
  getTimeAndDate,
  getWeather,
};
