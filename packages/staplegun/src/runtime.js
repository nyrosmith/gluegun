// @flow
import autobind from 'autobind-decorator'
import Plugin from './plugin'
import Command from './command'
import { when, equals, always, join, split, trim, pipe, replace, find, append, forEach, isNil } from 'ramda'
import { findByProp, startsWith } from 'ramdasauce'
import { isBlank } from './utils'
import RunContext from './run-context'

const COMMAND_DELIMITER = ' '

/**
 * Strips the command out of the args returns an array of the rest.
 *
 * @param {string} args The full arguments including command.
 * @param {string} commandName The name of the command to strip.
 */
const extractSubArguments = (args: string, commandName: string): string[] =>
  pipe(
    replace(commandName, ''),
    trim,
    split(COMMAND_DELIMITER),
    when(equals(['']), always([]))
  )(args)

/**
 * Loads plugins an action through the gauntlet.
 */
@autobind
class Runtime {

  plugins = []

  /**
   * Adds a plugin.
   */
  addPlugin (plugin: Plugin): void {
    this.plugins = append(plugin, this.plugins)
  }

  /**
   * Loads a plugin from a directory.
   */
  addPluginFromDirectory (directory: string): Plugin|void {
    const plugin = new Plugin()
    plugin.loadFromDirectory(directory)
    this.addPlugin(plugin)
    return plugin
  }

  /**
   * Returns a list of commands for printing
   */
  listCommands () {
    const commands = []
    const eachPlugin = plugin => {
      const eachCommand = command => {
        commands.push({
          plugin: plugin.namespace,
          command: command.name,
          description: command.description
        })
      }
      forEach(eachCommand, plugin.commands)
    }
    forEach(eachPlugin, this.plugins)
    return commands
  }

  /**
   *
   * Find the plugin for this namespace.
   *
   * @param {string} namespace
   * @returns {*} A Plugin otherwise null.
   */
  findPlugin (namespace: ?string): ?Plugin {
    return findByProp('namespace', namespace || '', this.plugins)
  }

  /**
   * Find the command for this namespace & command.
   *
   * @param {Plugin} plugin The plugin in which the command lives.
   * @param {string} fullArguments The command arguments to parse.
   * @returns {*} A Command otherwise null.
   */
  findCommand (plugin: Plugin, fullArguments: string): ?Command {
    if (isNil(plugin) || isBlank(fullArguments)) return null
    if (plugin.commands.length === 0) return null

    return find(
      (command: Command) => startsWith(command.name, fullArguments)
      , plugin.commands
      )
  }

  /**
   * Runs a command.
   */
  async run (namespace: string, fullArguments: string = '', options: any = {}): RunContext {
    // prepare the run context
    const context = new RunContext()
    context.fullArguments = fullArguments
    context.options = options

    // find the plugin
    const plugin = this.findPlugin(namespace)
    if (!plugin) {
      return context
    }
    context.plugin = plugin

    // find the command
    const command: ?Command = this.findCommand(plugin, fullArguments)
    if (!command) {
      return context
    }
    context.command = command

    // parse & chop up the arguments
    context.arguments = extractSubArguments(fullArguments, trim(command.name))
    context.stringArguments = join(COMMAND_DELIMITER, context.arguments)

    // kick it off
    await context.run()

    // return the whole RunContext
    return context
  }
}

export default Runtime
