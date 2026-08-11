import { describe, it, expect } from 'vitest';
import { analyzeCvForAts, optimizeCvForAts } from '../app/lib/cvOptimizer';

const weakCv = `
João da Silva
Desenvolvedor
São Paulo

Eu era responsável por dar suporte ao sistema interno. Trabalhava com Java e fazia manutenção de telas.

Conhecimento em bancos de dados.
`;

const strongCv = `
Maria Souza
maria@email.com
(11) 98765-4321
São Paulo – SP
linkedin.com/in/maria-souza

RESUMO
Desenvolvedora júnior com experiência em React, TypeScript e Node.js. Busco oportunidade de estágio ou nível júnior.

EXPERIÊNCIA
Empresa X — Desenvolvedora Júnior (01/2023 – atual)
- Desenvolvi e otimizei telas com React, reduzindo o tempo de carregamento em 40%.
- Implementei APIs REST com Node.js e integração com bancos SQL.

FORMAÇÃO
Análise e Desenvolvimento de Sistemas — Faculdade Y (2022 – 2025)

HABILIDADES
React, TypeScript, Node.js, SQL, Git
`;

describe('analyzeCvForAts', () => {
  it('flags weak CV: missing contact, weak phrases, low score', () => {
    const result = analyzeCvForAts(weakCv);
    const email = result.checks.find((check) => check.id === 'email');
    const phone = result.checks.find((check) => check.id === 'phone');
    expect(email?.passed).toBe(false);
    expect(phone?.passed).toBe(false);
    expect(result.weakPhrases.length).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThan(60);
    expect(result.verdict).toBe('critico');
    expect(result.improvements.length).toBeGreaterThan(0);
  });

  it('approves a well-structured CV', () => {
    const result = analyzeCvForAts(strongCv);
    const checks = result.checks.map((check) => check.id);
    expect(checks).toContain('email');
    expect(checks).toContain('quantified');
    expect(result.weakPhrases.length).toBe(0);
    expect(result.overallScore).toBeGreaterThanOrEqual(70);
  });
});

describe('optimizeCvForAts', () => {
  it('adds missing sections and rewrites weak phrases', () => {
    const result = optimizeCvForAts(weakCv, ['java']);
    expect(result.changes.length).toBeGreaterThan(0);
    expect(result.text).toContain('RESUMO');
    expect(result.text).toContain('HABILIDADES');
    expect(result.text).not.toMatch(/responsável por/i);
    expect(result.text).not.toMatch(/trabalhava com/i);
  });

  it('keeps a strong CV mostly intact', () => {
    const result = optimizeCvForAts(strongCv, ['react']);
    expect(result.text).toContain('React');
    expect(result.text).not.toMatch(/responsável por/i);
  });

  it('handles empty input', () => {
    const result = optimizeCvForAts('   ');
    expect(result.text).toBe('');
    expect(result.changes.length).toBe(1);
  });
});
