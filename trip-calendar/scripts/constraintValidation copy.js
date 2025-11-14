function validateTrip(segments) {
    const results = [];

    for (const seg of segments) {
        if (!Array.isArray(seg.constraints)) continue;

        for (const c of seg.constraints) {
            const constraintType = constraintTypes[c.type];
            if (!constraintType) continue;

            const validator = constraintValidators[c.type];
            //console.log(validator);
            if (!validator) {
                console.warn("No validator for constraint type", c.type);
                continue;
            }

            const r = validator(seg, segments, c);
            if (Array.isArray(r)) results.push(...r);
            else if (r) results.push(r);
        }
    }

    return results;
}

function verror(seg, c, msg) {
    return {
        segmentId: seg.id,
        constraint: c,
        severity: "error",
        message: msg
    };
}

function vwarn(seg, c, msg) {
    return {
        segmentId: seg.id,
        constraint: c,
        severity: "warning",
        message: msg
    };
}


const constraintValidators = {
    visit: validate_visit,
    dateRange: validate_dateRange,
    //duration: validate_duration,
    //arrival: validate_arrival,
    /**
      departure: validate_departure,
      daysOfWeek: validate_daysOfWeek,
      holidays: validate_holidays,
      businessHours: validate_businessHours,
      visitInsideBusinessHours: validate_visitInsideBusinessHours,
      minAfterOpen: validate_minAfterOpen,
      maxBeforeClose: validate_maxBeforeClose,
      blackout: validate_blackout,
      avoidTimes: validate_avoidTimes,
      mustPrecede: validate_mustPrecede,
      mustFollow: validate_mustFollow
    */
};

function validate_visit(seg, segments, c) {
    const { mode, params } = c;

    if (!seg.start?.utc) return vwarn(seg, c, "Segment missing start time");
    const start = new Date(seg.start.utc);
    const local = (d) => new Intl.DateTimeFormat("en-US", {
        hour: "2-digit", minute: "2-digit", hour12: false,
        timeZone: seg.timeZone
    }).format(d);

    if (mode === "timeRange") {
        const tl = params.startTime;  // "09:00"
        const tr = params.endTime;    // "15:00"
        if (!tl || !tr) return null;

        const segTimeNum = start.getHours() * 60 + start.getMinutes();
        const minNum = Number(tl.slice(0,2)) * 60 + Number(tl.slice(3,5));
        const maxNum = Number(tr.slice(0,2)) * 60 + Number(tr.slice(3,5));
        console.log(segTimeNum);
        console.log(minNum);
        console.log(maxNum);
        if (segTimeNum < minNum || segTimeNum > maxNum) {
            return verror(seg, c,
                `Visit must be between ${tl}–${tr}, but starts at ${start.toISOString()}`);
        }
    }
    if (mode === "dateTimeRange") {
        const s = new Date(params.startDateTime);
        const e = new Date(params.endDateTime);
        if (start < s || start > e) {
            return verror(seg, c,
                `Visit must be between ${params.startDateTime}–${params.endDateTime}`);
        }
    }

    if (mode === "dateRange") {
        const { startDate, endDate } = params.ranges || {};
        if (!startDate || !endDate) return null;

        const segDate = seg.start.utc.slice(0, 10);
        if (segDate < startDate || segDate > endDate) {
            return verror(seg, c,
                `Visit must be between ${startDate}–${endDate}`);
        }
    }

    return null;
}











