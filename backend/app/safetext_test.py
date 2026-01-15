from safetext import SafeText

st = SafeText(language='ja')

results = st.check_profanity(text='うんちうんちうんち')
print(results)