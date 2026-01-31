// 表单验证工具

const rules = {
  required: (value) => value !== null && value !== undefined && value !== '',
  number: (value) => !isNaN(value) && value !== '',
  email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
  phone: (value) => /^1[3-9]\d{9}$/.test(value),
  idCard: (value) => /^(\d{18}|\d{15})$/.test(value)
}

export const validate = (data, schema) => {
  const errors = {}

  for (const [field, fieldRules] of Object.entries(schema)) {
    const value = data[field]
    const fieldErrors = []

    if (typeof fieldRules === 'string') {
      const ruleArray = fieldRules.split('|')
      for (const rule of ruleArray) {
        const [ruleName, ...params] = rule.split(':')
        
        if (ruleName === 'required') {
          if (!rules.required(value)) {
            fieldErrors.push(`${field} 是必填项`)
          }
        } else if (ruleName === 'number') {
          if (value && !rules.number(value)) {
            fieldErrors.push(`${field} 必须是数字`)
          }
        } else if (ruleName === 'min' && value) {
          const min = parseInt(params[0])
          if (parseInt(value) < min) {
            fieldErrors.push(`${field} 最小值为 ${min}`)
          }
        } else if (ruleName === 'max' && value) {
          const max = parseInt(params[0])
          if (parseInt(value) > max) {
            fieldErrors.push(`${field} 最大值为 ${max}`)
          }
        } else if (ruleName === 'in' && value) {
          const allowedValues = params
          if (!allowedValues.includes(value)) {
            fieldErrors.push(`${field} 值不在允许范围内`)
          }
        }
      }
    }

    if (fieldErrors.length > 0) {
      errors[field] = fieldErrors[0]
    }
  }

  return errors
}

// 成绩表单验证规则
export const scoreFormRules = {
  year: 'required|number|min:2000|max:2100',
  season: 'required|in:Q1:Q2:Q3:Q4',
  distance: 'required|in:18m:30m:50m:70m',
  competition_format: 'required|in:ranking:elimination:team',
  gender_group: 'required',
  raw_score: 'required|number|min:0',
  rank: 'required|number|min:1',
  participant_count: 'required|number|min:1'
}

// 运动员表单验证规则
export const athleteFormRules = {
  name: 'required',
  phone: 'required|phone',
  id_number: 'required|idCard',
  gender: 'required|in:male:female:mixed'
}
