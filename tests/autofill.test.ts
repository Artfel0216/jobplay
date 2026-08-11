import { describe, it, expect } from 'vitest';
import FormAutofill from '../extension/autofill.js';

const { parseCvText, buildProfile, resolveFieldKey } = FormAutofill;

const sampleCv = `
Maria Souza
Desenvolvedora Júnior
maria@email.com
(11) 98765-4321
Recife – PE
linkedin.com/in/maria-souza
github.com/mariasouza

RESUMO
Desenvolvedora júnior com 2 anos de experiência em React, TypeScript e Node.js.

FORMAÇÃO
Análise e Desenvolvimento de Sistemas

HABILIDADES
React, TypeScript, Node.js, SQL, Git

IDIOMAS
Inglês intermediário
`;

describe('parseCvText', () => {
  it('extracts contact, location and profile data from the resume', () => {
    const parsed = parseCvText(sampleCv);
    expect(parsed.name).toContain('Maria');
    expect(parsed.email).toBe('maria@email.com');
    expect(parsed.phone).toContain('98765');
    expect(parsed.city).toBe('Recife');
    expect(parsed.state).toBe('PE');
    expect(parsed.linkedin).toContain('linkedin.com/in/maria-souza');
    expect(parsed.github).toContain('github.com/mariasouza');
    expect(parsed.yearsOfExperience).toBe(2);
    expect(parsed.skills).toContain('React');
    expect(parsed.skills).toContain('SQL');
    expect(parsed.languages).toContain('Inglês');
    expect(parsed.education).toContain('analise e desenvolvimento');
  });

  it('handles empty or whitespace input', () => {
    const parsed = parseCvText('   ');
    expect(parsed.name).toBe('');
    expect(parsed.email).toBe('');
    expect(parsed.skills).toEqual([]);
  });
});

describe('buildProfile', () => {
  it('gives manual profile priority over resume data', () => {
    const profile = buildProfile(
      { name: 'Ana Lima', email: 'ana@empresa.com', state: 'SP' },
      sampleCv,
    );
    expect(profile.name).toBe('Ana Lima');
    expect(profile.email).toBe('ana@empresa.com');
    expect(profile.state).toBe('SP');
    expect(profile.firstName).toBe('Ana');
    expect(profile.lastName).toBe('Lima');
  });

  it('fills gaps with resume data when profile is empty', () => {
    const profile = buildProfile({}, sampleCv);
    expect(profile.email).toBe('maria@email.com');
    expect(profile.city).toBe('Recife');
    expect(profile.skills).toContain('Node.js');
  });
});

describe('resolveFieldKey', () => {
  it('recognizes common application form fields', () => {
    expect(resolveFieldKey('Nome completo')).toBe('name');
    expect(resolveFieldKey('primeiro nome')).toBe('firstName');
    expect(resolveFieldKey('Sobrenome')).toBe('lastName');
    expect(resolveFieldKey('e-mail')).toBe('email');
    expect(resolveFieldKey('email')).toBe('email');
    expect(resolveFieldKey('Telefone celular')).toBe('phone');
    expect(resolveFieldKey('WhatsApp')).toBe('phone');
    expect(resolveFieldKey('Cidade')).toBe('city');
    expect(resolveFieldKey('Estado (UF)')).toBe('state');
    expect(resolveFieldKey('País')).toBe('country');
    expect(resolveFieldKey('LinkedIn')).toBe('linkedin');
    expect(resolveFieldKey('GitHub')).toBe('github');
    expect(resolveFieldKey('Portfólio')).toBe('portfolio');
    expect(resolveFieldKey('Pretensão salarial')).toBe('desiredSalary');
    expect(resolveFieldKey('Escolaridade')).toBe('education');
    expect(resolveFieldKey('Habilidades')).toBe('skills');
    expect(resolveFieldKey('Idiomas')).toBe('languages');
    expect(resolveFieldKey('Conte sobre você')).toBe('summary');
    expect(resolveFieldKey('Anos de experiência')).toBe('yearsOfExperience');
  });

  it('does not map sensitive fields from the resume', () => {
    expect(resolveFieldKey('CPF')).toBe('');
    expect(resolveFieldKey('Data de nascimento')).toBe('');
    expect(resolveFieldKey('Gênero')).toBe('');
    expect(resolveFieldKey('Organização')).toBe('');
    expect(resolveFieldKey('Estado civil')).toBe('');
  });
});
